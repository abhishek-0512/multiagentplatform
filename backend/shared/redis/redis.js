import Redis from "ioredis";

const memoryStore = new Map();

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
                // fallback to memory
            }
        }
        return memoryStore.get(key) || null;
    },
    async set(key, value, mode, duration) {
        memoryStore.set(key, value);
        if (isRedisConnected) {
            try {
                if (mode && duration) {
                    return await redisClient.set(key, value, mode, duration);
                }
                return await redisClient.set(key, value);
            } catch (e) {
                // fallback to memory
            }
        }
        return "OK";
    },
    async del(key) {
        memoryStore.delete(key);
        if (isRedisConnected) {
            try {
                return await redisClient.del(key);
            } catch (e) {
                // fallback to memory
            }
        }
        return 1;
    }
};

export default redis;