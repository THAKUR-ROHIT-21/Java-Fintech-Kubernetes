import asyncio
import json
import random
import time
import uuid
from collections import Counter

import httpx


TARGET_URL = "http://api.banking.biharibabu.online/api/auth/register"

# Pehle small test karo
TOTAL_REQUESTS = 5000
CONCURRENCY = 100

REQUEST_TIMEOUT_SECONDS = 15.0


def build_payload() -> dict:
    unique_id = uuid.uuid4().hex[:12]
    phone = f"9{random.randint(100000000, 999999999)}"

    return {
        "fullName": f"LoadTest User {unique_id}",
        "email": f"loadtest_{unique_id}@ledgerline.app",
        "phone": phone,
        "password": "password123",
    }


async def fire_request(
    client: httpx.AsyncClient,
    semaphore: asyncio.Semaphore,
) -> dict:
    async with semaphore:
        payload = build_payload()
        start = time.perf_counter()

        try:
            response = await client.post(
                TARGET_URL,
                json=payload,
            )

            elapsed_ms = (time.perf_counter() - start) * 1000

            return {
                "status": response.status_code,
                "elapsed_ms": elapsed_ms,
                "error": None,
                "response": response.text[:200],
            }

        except httpx.TimeoutException as exc:
            elapsed_ms = (time.perf_counter() - start) * 1000

            return {
                "status": 0,
                "elapsed_ms": elapsed_ms,
                "error": f"timeout: {exc}",
                "response": "",
            }

        except httpx.HTTPError as exc:
            elapsed_ms = (time.perf_counter() - start) * 1000

            return {
                "status": 0,
                "elapsed_ms": elapsed_ms,
                "error": str(exc),
                "response": "",
            }


def percentile(values: list[float], percentile_value: float) -> float:
    if not values:
        return 0.0

    sorted_values = sorted(values)
    index = round((len(sorted_values) - 1) * percentile_value)

    return sorted_values[index]


async def run_load_test(total: int, concurrency: int) -> dict:
    semaphore = asyncio.Semaphore(concurrency)
    started_at = time.perf_counter()

    limits = httpx.Limits(
        max_connections=concurrency,
        max_keepalive_connections=concurrency,
    )

    timeout = httpx.Timeout(
        connect=5.0,
        read=REQUEST_TIMEOUT_SECONDS,
        write=REQUEST_TIMEOUT_SECONDS,
        pool=REQUEST_TIMEOUT_SECONDS,
    )

    async with httpx.AsyncClient(
        limits=limits,
        timeout=timeout,
        follow_redirects=True,
    ) as client:

        tasks = [
            asyncio.create_task(
                fire_request(client, semaphore)
            )
            for _ in range(total)
        ]

        results = await asyncio.gather(*tasks)

    total_duration = time.perf_counter() - started_at

    response_times = [
        result["elapsed_ms"]
        for result in results
    ]

    status_breakdown = Counter(
        str(result["status"])
        if result["status"] != 0
        else "connection_error"
        for result in results
    )

    success_count = sum(
        1
        for result in results
        if 200 <= result["status"] < 300
    )

    failed_results = [
        result
        for result in results
        if not 200 <= result["status"] < 300
    ]

    return {
        "target_url": TARGET_URL,
        "total_requests": total,
        "concurrency": concurrency,
        "success_count": success_count,
        "failed_count": total - success_count,
        "status_code_breakdown": dict(status_breakdown),
        "average_response_time_ms": round(
            sum(response_times) / len(response_times),
            2,
        ) if response_times else 0,
        "p50_response_time_ms": round(
            percentile(response_times, 0.50),
            2,
        ),
        "p95_response_time_ms": round(
            percentile(response_times, 0.95),
            2,
        ),
        "p99_response_time_ms": round(
            percentile(response_times, 0.99),
            2,
        ),
        "minimum_response_time_ms": round(
            min(response_times),
            2,
        ) if response_times else 0,
        "maximum_response_time_ms": round(
            max(response_times),
            2,
        ) if response_times else 0,
        "total_duration_seconds": round(
            total_duration,
            2,
        ),
        "requests_per_second": round(
            total / total_duration,
            2,
        ) if total_duration > 0 else 0,
        "sample_failures": failed_results[:5],
    }


async def main() -> None:
    print(f"Target: {TARGET_URL}")
    print(f"Total requests: {TOTAL_REQUESTS}")
    print(f"Concurrency: {CONCURRENCY}")
    print()

    result = await run_load_test(
        total=TOTAL_REQUESTS,
        concurrency=CONCURRENCY,
    )

    print("=" * 60)
    print("LOAD TEST RESULTS")
    print("=" * 60)
    print(json.dumps(result, indent=2))
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())