import { redisClient } from "./startServer"

export const acquireLock = async ({
  lockKey,
  timeout = 10,
}: {
  lockKey: string
  timeout?: number
}) => {
  const maxAttempts = 2
  const retryDelayMs = 1200

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(
      `Attempting to acquire lock (attempt ${attempt}/${maxAttempts})`
    )

    const acquired = await redisClient.set(lockKey, "locked", {
      NX: true,
      EX: timeout,
    })

    if (acquired) {
      console.log(`Lock acquired on attempt ${attempt}`)
      return true
    }

    if (attempt < maxAttempts) {
      console.log(
        `Lock acquisition failed, waiting ${retryDelayMs}ms before retry`
      )
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
    }
  }

  console.log("Failed to acquire lock after all attempts")
  return false
}
