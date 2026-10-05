def chunk_page(text: str, max_words=220, overlap=30):
    words = text.split()
    if len(words) <= max_words:
        return [text]
    step = max_words - overlap
    return [" ".join(words[i:i + max_words]) for i in range(0, len(words), step)]