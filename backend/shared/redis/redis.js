import Redis from "ioredis";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storeFilePath = path.join(__dirname, ".session_store.json");

const readStore = () => {
    try {
        if (fs.existsSync(storeFilePath)) {
            const raw = fs.readFileSync(storeFilePath, "utf8");
            return JSON.parse(raw);
        }
    } catch (e) {
        // ignore read error
    }
    return {};
};

const writeStore = (data) => {
    try {
        fs.writeFileSync(storeFilePath, JSON.stringify(data), "utf8");
    } catch (e) {
        // ignore write error
    }
};

const redisClient = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
        if (times > 3) {
            return null;
        }
        return 2000;
    }
});

let isRedisConnected = false;

redisClient.on("connect", () => {
    isRedisConnected = true;
    console.log("redis connected");
});

redisClient.on("error", () => {
    isRedisConnected = false;
});

const redis = {
    async get(key) {
        if (isRedisConnected) {
            try {
                return await redisClient.get(key);
            } catch (e) {
                // fallback to shared store
            }
        }
        const store = readStore();
        const entry = store[key];
        if (!entry) return null;

        if (entry.expiresAt && Date.now() > entry.expiresAt) {
            delete store[key];
            writeStore(store);
            return null;
        }

        return typeof entry.value !== "undefined" ? entry.value : entry;
    },
    async set(key, value, mode, duration) {
        const store = readStore();
        let expiresAt = null;
        if (mode === "EX" && duration) {
            expiresAt = Date.now() + duration * 1000;
        }
        store[key] = { value, expiresAt };
        writeStore(store);

        if (isRedisConnected) {
            try {
                if (mode && duration) {
                    return await redisClient.set(key, value, mode, duration);
                }
                return await redisClient.set(key, value);
            } catch (e) {
                // fallback to shared store
            }
        }
        return "OK";
    },
    async del(key) {
        const store = readStore();
        delete store[key];
        writeStore(store);

        if (isRedisConnected) {
            try {
                return await redisClient.del(key);
            } catch (e) {
                // fallback to shared store
            }
        }
        return 1;
    }
};

export default redis;