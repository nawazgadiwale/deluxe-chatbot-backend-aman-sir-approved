export default class ChunkingService {
    constructor(strategy) {
        this.strategy = strategy;
    }

    async chunk(documents = []) {
        const chunks = [];

        for (const document of documents) {
            const sourceType = document.metadata.sourceType;

            const splitter =
                this.strategy.getSplitter(sourceType);

            if (!splitter) {
                chunks.push(document);
                continue;
            }

            const splitDocuments =
                await splitter.splitDocuments([document]);

            chunks.push(...splitDocuments);
        }

        return chunks;
    }
}