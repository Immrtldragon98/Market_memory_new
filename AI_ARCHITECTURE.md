# AI architecture decision record

## Product job

AI is a reflection layer over a user's own market journal. It is not a trading
signal engine. Every factual answer must remain traceable to journal entry IDs.

## V0 stack

| Capability | Choice | Reason |
|---|---|---|
| Hosted inference | Groq primary, OpenRouter fallback | Fast free entry point and one fallback route |
| Model access | Direct OpenAI-compatible HTTP | Two small adapters do not justify a framework |
| Model selection | Environment variables | Swap Llama, Mistral, GPT, Gemini, or Claude without application rewrites |
| User context | Bounded Supabase journal query | Predictable privacy, latency, and token cost |
| Tool protocol | MCP Python SDK | Standard read-only access for external assistants |
| Deployment | Koyeb Docker, then Oracle VM | One artifact and no Vercel Python coupling |

OpenRouter can route to many model families, but paid GPT, Gemini, and Claude
models are not treated as free. `openrouter/free` is the default fallback and
its model availability can change. Groq model IDs are configuration, not code.

Ollama is useful for local development on the owner's RTX 3050, but a cloud API
cannot call a laptop-local Ollama server. Do not expose Ollama directly to the
internet. A future provider adapter may use it only on a private network.

## RAG phase (not V0)

Add document RAG only when users can upload filings, research notes, or exported
reports. Use one component per job:

| Job | Initial choice | Deferred alternatives |
|---|---|---|
| Extraction | Docling | Crawl4AI for public web; Firecrawl/LlamaParse when paid quality is justified |
| Embeddings | SBERT locally | Voyage, OpenAI, or Google after measured quality/cost need |
| Vector search | Qdrant | Chroma for experiments; Pinecone/Milvus/Weaviate only after scale evidence |
| Evaluation | Ragas plus a hand-labeled test set | TruLens/Giskard after production observability exists |

Documents must be chunked with tenant and source metadata. Retrieval must filter
by verified user ID before similarity search. Generated claims must cite chunk
IDs and source locations. Deletion must remove the source, chunks, vectors, and
cached generations together.

## Framework rule

Do not install LangChain, LlamaIndex, and Haystack together. The current flow is
simple enough to keep explicit. Introduce exactly one orchestration framework
only when the system needs multi-step retrieval, reranking, or durable workflows
and a measured implementation comparison proves it reduces complexity.

## Brutal risk register

1. The global Supabase service-role client bypasses RLS. Manual owner filters are
   a fragile interim control. Move user-owned operations to request-scoped JWT
   clients before adding more AI tools.
2. The rate limiter is process-local. Multi-instance deployment needs Redis or
   Valkey with atomic counters.
3. Free inference tiers provide no capacity guarantee. Timeouts and model churn
   are normal; keep fallback, strict budgets, and a non-AI user path.
4. AI answers are not persisted or cost-audited yet. Add generation metadata,
   latency, token counts, provider, model, and cited sources before public beta.
5. Prompt injection remains possible in user documents. Treat retrieved text as
   data, never instructions, and restrict tools independently of model output.
6. Supabase bearer validation currently performs a network lookup per MCP
   request. Add short-lived verification caching only after revocation behavior
   is explicitly defined.
7. Koyeb free instances can cold-start and are not an SLA. Oracle avoids sleep
   but requires patching, firewalling, TLS, backups, and monitoring by the owner.
8. Stateful Streamable HTTP MCP sessions do not belong on basic Lambda. Keep
   Lambda for REST endpoints unless session state is externalized and tested.

## Gates before public AI beta

- Request-scoped database client for user-owned tables.
- Cross-user authorization tests for every tool and assistant query.
- Prompt-injection and citation-grounding evaluation set.
- Shared rate limiting and daily per-user token budget.
- Redacted structured logs, request IDs, latency, and provider health metrics.
- Visible user consent explaining what journal text is sent to model providers.
- Data deletion and AI-history retention behavior verified end to end.
