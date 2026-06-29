import asyncio
import json
from app.services.llm_client import call_llm_json_with_system

async def main():
    print(" Testing OpenAI SDK wrapper...")
    try:
        result = await call_llm_json_with_system(
            prompt="Create a test profile for an AI engineer.",
            system="You are a system that only outputs JSON. Return exactly this shape: {'name': 'string', 'skills': ['string']}",
            temperature=0.1
        )
        print("\n Success:\n")
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(f"\n Failed: {e}")

if __name__ == "__main__":
    asyncio.run(main())