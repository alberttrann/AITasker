# Test Data

## Seam Verify (Expert Profile)
--------------------------------------------------------------------------------
OPTION 1: TESTING VIA WEB UI (http://localhost:5173/expert/expert-profile)
--------------------------------------------------------------------------------
[1] Claim the Domains:
Select Domain A, Domain D, and Domain E (Set all depths to DEEP).

[2] Claim the 2 Seams:
Select the seam "A↔D" (Retrieval-generation contract).
Select the seam "D↔E" (Embedding pipeline contract).

[3] Portfolio Submission for Seam 1 (A↔D):

▶ PROJECT DESCRIPTION (A↔D):
I engineered a production Retrieval-Augmented Generation (RAG) system for a financial services firm, integrating a custom Python vector retrieval microservice (Domain A) with our main Java Spring Boot transactional backend (Domain D). The system processes customer queries against 100,000+ proprietary financial documents using OpenAI GPT-4 and Pinecone vector search, delivering responses directly into the main customer-facing dashboard.

▶ DECISION POINTS (A↔D):
The core challenge was the Retrieval-generation contract. I evaluated streaming vs polling for the generated text and chose Server-Sent Events (SSE) streaming to mitigate perceived latency, as polling saturated our backend thread pools. A key failure mode was the LLM generating hallucinations when retrieval yielded no relevant vectors; I implemented a hard boundary fallback in the Java backend that overrides the LLM with a canned response if the vector similarity score drops below 0.82. This tradeoff favored accuracy over conversation continuity. The measurable outcome was a 65% reduction in hallucination reports and a 200ms decrease in time-to-first-token (TTFT).

[4] Portfolio Submission for Seam 2 (D↔E):

▶ PROJECT DESCRIPTION (D↔E):
I built an automated embedding generation pipeline that consumed raw text data from our Kafka message bus (Domain D), processed it through a local instance of sentence-transformers, and upserted the resulting dense vectors into a Qdrant vector database (Domain E). The system had to handle 5 million daily event updates and ensure that stale embeddings were reliably purged or re-embedded.

▶ DECISION POINTS (D↔E):
The key embedding pipeline contract decision was managing the batch size vs throughput tradeoff for vector upserts. I chose a batch size of 500 documents to maximize GPU utilization on the embedding side without triggering timeout limits on the Qdrant insertion endpoint. A major failure mode was partial batch failures when raw text contained corrupted encoding; I handled this by implementing a Dead Letter Queue (DLQ) specifically for the embedding node, ensuring the rest of the batch succeeded. As a measurable outcome, this architecture achieved a 99.9% embedding success rate and reduced end-to-end vector availability latency from 15 minutes to under 2 minutes.

## Elicitation

### stage 1
We run an online fashion retail store and our customer support team is drowning in tickets. We get about 1,200 support emails and chats per day, mostly asking "where is my order" or requesting a return. Right now it takes our team an average of 6 hours to respond, and customers are getting frustrated.

We want an AI agent that can read incoming customer messages, look up the order status in our Shopify store, and respond automatically for simple cases like order tracking and return requests. If the question is complicated or the customer is upset, it should hand off to a human agent.

We have about 50,000 monthly active customers and expect this to grow to 80,000 within the year. Our target is for the AI to respond within 2 minutes for simple queries. We're integrated with Zendesk for our support inbox already. Our budget for this project is around 800,000,000 VND.

### stage 2
pick first option

### stage 3
1. Roughly how many people will search or ask questions per day?
About 1,200 customer support queries per day, mostly order-status checks and return requests. We expect this to grow to around 1,800/day within a year as our customer base grows from 50,000 to 80,000 monthly active users.

2. When someone gets a wrong or unhelpful answer, what do you expect to happen next?
The conversation should automatically escalate to a human support agent in Zendesk, with the full chat history attached so the agent doesn't have to ask the customer to repeat themselves. We also want a "thumbs down" option so customers can flag a bad answer directly, which creates a follow-up ticket for review.

3. Does this need to pull from documents/systems you already have, and which ones?
Yes — it needs to pull live order status, shipping info, and return eligibility from our Shopify store via the Shopify Admin API. It also needs to read and write to our Zendesk support inbox via the Zendesk API to send responses and log escalations. No other systems are involved right now.

4. How quickly does an answer need to appear after someone asks?
Under 2 minutes for simple queries like order tracking or return status. If it needs to escalate to a human, that handoff should happen within 30 seconds so the customer isn't left waiting.

### stage 4
Scale and Infrastructure:
We're a mid-sized e-commerce business with 50,000 monthly active customers, growing to an estimated 80,000 within a year. We currently run on Shopify Plus for our storefront and Zendesk for customer support, both cloud-hosted — we don't manage our own servers for these. We have a small internal team (2 backend engineers) who could support light integration work but don't have infrastructure experience with high-scale AI systems.

Integration Method:
We'd prefer direct API integration — Shopify Admin API for order/return data and Zendesk API for reading and responding to support tickets. Both are already enabled on our current paid plans, so we're hoping to avoid custom middleware or scraping. We're open to a lightweight integration layer if needed to connect the AI to both APIs.

Legacy Volume:
We have about 3 years of historical order and support ticket data — roughly 500,000 past orders and 250,000 resolved support tickets in Zendesk. We don't need the AI to be trained on all of this, but we'd like the option to use recent resolved tickets (last 3 months, ~90,000 tickets) as reference data for grounding responses and for the evaluation baseline.

Additional Requirements (optional):
We need to comply with Vietnam's Personal Data Protection Decree (Decree 13/2023/ND-CP) since our customers are mostly domestic. No SSO requirement for this project — it's customer-facing, not internal tooling. No cross-border data transfer; all data should stay within our existing Shopify/Zendesk infrastructure.
