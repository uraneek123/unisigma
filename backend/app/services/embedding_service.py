from sentence_transformers import SentenceTransformer


class EmbeddingService:
    def __init__(self):
        self.model = SentenceTransformer("all-MiniLM-L6-v2")

    def embed_problem(self, problem_text: str) -> list[float]:
        embedding = self.model.encode(problem_text)
        return embedding.tolist()


embedding_service = EmbeddingService()
