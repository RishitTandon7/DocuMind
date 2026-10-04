"""
Async Neo4j client.

Wraps the official Neo4j async driver behind typed helpers for writing a
document's extracted entities/relationships and reading back the graph for
the API and for hybrid retrieval traversal.
"""

from neo4j import AsyncDriver, AsyncGraphDatabase

from config import get_settings
from graph.entity_extractor import ExtractionResult
from utils.logger import logger

settings = get_settings()

_driver: AsyncDriver | None = None


async def connect() -> None:
    """Create the global Neo4j async driver and verify connectivity."""
    global _driver
    if _driver is not None:
        return
    logger.info(f"Connecting to Neo4j at {settings.neo4j_uri}")
    _driver = AsyncGraphDatabase.driver(
        settings.neo4j_uri, auth=(settings.neo4j_user, settings.neo4j_password)
    )
    await _driver.verify_connectivity()
    logger.info("Neo4j connection established")


async def disconnect() -> None:
    """Close the global Neo4j async driver."""
    global _driver
    if _driver is not None:
        await _driver.close()
        _driver = None
        logger.info("Neo4j connection closed")


def get_driver() -> AsyncDriver:
    """Return the active Neo4j driver, raising if it has not been initialized."""
    if _driver is None:
        raise RuntimeError("Neo4j driver is not initialized. Call graph.neo4j_client.connect() first.")
    return _driver


async def write_extraction(document_id: str, extraction: ExtractionResult) -> None:
    """Persist a document's extracted entities and relationships into Neo4j."""
    driver = get_driver()
    async with driver.session() as session:
        await session.run(
            """
            MERGE (d:Document {id: $document_id})
            """,
            document_id=document_id,
        )
        for entity in extraction.entities:
            await session.run(
                """
                MATCH (d:Document {id: $document_id})
                MERGE (e:Entity {id: $entity_id, document_id: $document_id})
                SET e.label = $label, e.type = $type
                MERGE (d)-[:CONTAINS]->(e)
                """,
                document_id=document_id,
                entity_id=entity.id,
                label=entity.label,
                type=entity.type,
            )
        for relationship in extraction.relationships:
            await session.run(
                """
                MATCH (a:Entity {id: $source_id, document_id: $document_id})
                MATCH (b:Entity {id: $target_id, document_id: $document_id})
                MERGE (a)-[r:RELATES_TO {type: $relation}]->(b)
                """,
                document_id=document_id,
                source_id=relationship.source,
                target_id=relationship.target,
                relation=relationship.relation,
            )
    logger.info(f"Wrote {len(extraction.entities)} entities and {len(extraction.relationships)} edges for document {document_id}")


async def delete_document_graph(document_id: str) -> None:
    """Remove a document node and all of its entities/relationships."""
    driver = get_driver()
    async with driver.session() as session:
        await session.run(
            "MATCH (e:Entity {document_id: $document_id}) DETACH DELETE e", document_id=document_id
        )
        await session.run("MATCH (d:Document {id: $document_id}) DETACH DELETE d", document_id=document_id)
    logger.info(f"Deleted Neo4j graph for document {document_id}")


async def get_graph(document_id: str) -> tuple[list[dict], list[dict]]:
    """Fetch all nodes and edges belonging to a document's Knowledge Graph."""
    driver = get_driver()
    nodes: list[dict] = []
    edges: list[dict] = []
    async with driver.session() as session:
        entity_result = await session.run(
            "MATCH (e:Entity {document_id: $document_id}) RETURN e.id AS id, e.label AS label, e.type AS type",
            document_id=document_id,
        )
        async for record in entity_result:
            nodes.append({"id": record["id"], "label": record["label"], "type": record["type"]})

        edge_result = await session.run(
            """
            MATCH (a:Entity {document_id: $document_id})-[r:RELATES_TO]->(b:Entity {document_id: $document_id})
            RETURN a.id AS source, b.id AS target, r.type AS relation
            """,
            document_id=document_id,
        )
        async for record in edge_result:
            edges.append(
                {"source": record["source"], "target": record["target"], "relation": record["relation"]}
            )
    return nodes, edges


async def find_related_entities(document_id: str, entity_labels: list[str], hops: int = 1) -> list[dict]:
    """Find entities within N hops of any entity whose label matches one of the given strings."""
    driver = get_driver()
    results: list[dict] = []
    async with driver.session() as session:
        query_result = await session.run(
            f"""
            MATCH (start:Entity {{document_id: $document_id}})
            WHERE toLower(start.label) IN $labels
            MATCH path = (start)-[:RELATES_TO*1..{hops}]-(related:Entity {{document_id: $document_id}})
            RETURN DISTINCT related.id AS id, related.label AS label, related.type AS type
            """,
            document_id=document_id,
            labels=[label.lower() for label in entity_labels],
        )
        async for record in query_result:
            results.append({"id": record["id"], "label": record["label"], "type": record["type"]})
    return results
