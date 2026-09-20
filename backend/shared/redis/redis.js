import Redis from "ioredis"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const storeFilePath = path.join(__dirname, ".store.json")

let isConnected = false

const readDiskStore = () => {
    try {
        if (fs.existsSync(storeFilePath)) {
            const data = JSON.parse(fs.readFileSync(storeFilePath, "utf8"))
            return data && typeof data === "object" ? data : { values: {}, expiries: {} }
        }
    } catch (e) {}
    return { values: {}, expiries: {} }
}

const writeDiskStore = (data) => {
    try {
        fs.writeFileSync(storeFilePath, JSON.stringify(data), "utf8")
    } catch (e) {}
}

const redisClient = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379", {
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => Math.min(times * 200, 3000),
    enableReadyCheck: false,
    lazyConnect: true
})

redisClient.connect().then(() => {
    isConnected = true
    console.log("redis connected")
}).catch((err) => {
    console.log("Redis offline, using shared file store:", err.message)
})

redisClient.on("connect", () => {
    isConnected = true
    console.log("redis connected")
})

redisClient.on("error", () => {
    isConnected = false
})

const redis = {
    async get(key) {
        if (isConnected) {
            try { 
                const res = await redisClient.get(key)
                if (res !== null) return res
            } catch (e) {}
        }
        const data = readDiskStore()
        const exp = data.expiries?.[key]
        if (exp && Date.now() > exp) {
            delete data.values[key]
            delete data.expiries[key]
            writeDiskStore(data)
            return null
        }
        return data.values?.[key] ?? null
    },
    async set(key, value, mode, duration) {
        if (isConnected) {
            try {
                if (mode && duration) {
                    await redisClient.set(key, value, mode, duration)
                } else {
                    await redisClient.set(key, value)
                }
            } catch (e) {}
        }
        const data = readDiskStore()
        if (!data.values) data.values = {}
        if (!data.expiries) data.expiries = {}
        data.values[key] = String(value)
        if (mode === "EX" && duration) {
            data.expiries[key] = Date.now() + Number(duration) * 1000
        }
        writeDiskStore(data)
        return "OK"
    },
    async del(key) {
        if (isConnected) {
            try { await redisClient.del(key) } catch (e) {}
        }
        const data = readDiskStore()
        if (data.values) delete data.values[key]
        if (data.expiries) delete data.expiries[key]
        writeDiskStore(data)
        return 1
    },
    async incr(key) {
        if (isConnected) {
            try { return await redisClient.incr(key) } catch (e) {}
        }
        const data = readDiskStore()
        if (!data.values) data.values = {}
        if (!data.expiries) data.expiries = {}

        const exp = data.expiries[key]
        if (exp && Date.now() > exp) {
            delete data.values[key]
            delete data.expiries[key]
        }

        const val = (Number(data.values[key]) || 0) + 1
        data.values[key] = String(val)
        writeDiskStore(data)
        return val
    },
    async expire(key, seconds) {
        if (isConnected) {
            try { return await redisClient.expire(key, seconds) } catch (e) {}
        }
        const data = readDiskStore()
        if (!data.expiries) data.expiries = {}
        data.expiries[key] = Date.now() + Number(seconds) * 1000
        writeDiskStore(data)
        return 1
    },
    async ttl(key) {
        if (isConnected) {
            try { return await redisClient.ttl(key) } catch (e) {}
        }
        const data = readDiskStore()
        const exp = data.expiries?.[key]
        if (!exp) return -1
        const remaining = Math.ceil((exp - Date.now()) / 1000)
        if (remaining <= 0) {
            delete data.values[key]
            delete data.expiries[key]
            writeDiskStore(data)
            return -2
        }
        return remaining
    },
    on(event, handler) {
        redisClient.on(event, handler)
    }
}

export default redis