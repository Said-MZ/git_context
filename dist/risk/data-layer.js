"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectDataLayerRisks = detectDataLayerRisks;
const DATA_LAYER_FILE_PATTERNS = [
    /migration/i,
    /schema/i,
    /models?\//i,
    /\.sql$/i,
    /prisma/i,
    /sequelize/i,
    /typeorm/i,
    /knex/i,
    /drizzle/i,
    /mongoose/i,
    /entity/i,
    /entities/i,
    /database/i,
    /db\//i,
];
const SQL_OPERATION_PATTERNS = [
    { pattern: /CREATE\s+TABLE\s+(\w+)/gi, operation: 'CREATE TABLE' },
    { pattern: /ALTER\s+TABLE\s+(\w+)/gi, operation: 'ALTER TABLE' },
    { pattern: /DROP\s+TABLE\s+(\w+)/gi, operation: 'DROP TABLE' },
    { pattern: /ADD\s+COLUMN\s+(\w+)/gi, operation: 'ADD COLUMN' },
    { pattern: /DROP\s+COLUMN\s+(\w+)/gi, operation: 'DROP COLUMN' },
    { pattern: /MODIFY\s+COLUMN\s+(\w+)/gi, operation: 'MODIFY COLUMN' },
    { pattern: /CREATE\s+INDEX/gi, operation: 'CREATE INDEX' },
    { pattern: /DROP\s+INDEX/gi, operation: 'DROP INDEX' },
    { pattern: /TRUNCATE\s+TABLE\s+(\w+)/gi, operation: 'TRUNCATE TABLE' },
    { pattern: /DELETE\s+FROM\s+(\w+)/gi, operation: 'DELETE FROM' },
    { pattern: /INSERT\s+INTO\s+(\w+)/gi, operation: 'INSERT INTO' },
    { pattern: /UPDATE\s+(\w+)\s+SET/gi, operation: 'UPDATE' },
];
const ORM_PATTERNS = [
    // Prisma
    { pattern: /model\s+(\w+)\s*\{/g, operation: 'Prisma model definition' },
    { pattern: /@@map\("(\w+)"\)/g, operation: 'Prisma table mapping' },
    // TypeORM
    { pattern: /@Entity\(.*?["'](\w+)["']/g, operation: 'TypeORM entity' },
    { pattern: /@Column\(/g, operation: 'TypeORM column change' },
    { pattern: /@ManyToOne|@OneToMany|@ManyToMany|@OneToOne/g, operation: 'TypeORM relation change' },
    // Sequelize
    { pattern: /sequelize\.define\(["'](\w+)["']/g, operation: 'Sequelize model' },
    { pattern: /queryInterface\.(createTable|dropTable|addColumn|removeColumn)/g, operation: 'Sequelize migration' },
    // Mongoose
    { pattern: /new\s+Schema\(/g, operation: 'Mongoose schema' },
    { pattern: /mongoose\.model\(["'](\w+)["']/g, operation: 'Mongoose model' },
    // Knex
    { pattern: /knex\.schema\.(createTable|alterTable|dropTable)/g, operation: 'Knex schema change' },
    { pattern: /table\.(string|integer|boolean|timestamp|json|uuid)/g, operation: 'Knex column definition' },
    // Drizzle
    { pattern: /pgTable|mysqlTable|sqliteTable/g, operation: 'Drizzle table definition' },
];
function detectDataLayerRisks(fileChanges, diffHunks) {
    const risks = [];
    const fileRisksMap = new Map();
    // Check file paths for data layer patterns
    for (const file of fileChanges) {
        for (const pattern of DATA_LAYER_FILE_PATTERNS) {
            if (pattern.test(file.path)) {
                if (!fileRisksMap.has(file.path)) {
                    fileRisksMap.set(file.path, { tables: new Set(), operations: new Set() });
                }
                break;
            }
        }
    }
    // Check diff content for SQL and ORM patterns
    for (const hunk of diffHunks) {
        const allChangedLines = [...hunk.addedLines, ...hunk.removedLines].join('\n');
        let riskEntry = fileRisksMap.get(hunk.file);
        let hasDataLayerChanges = false;
        // Check SQL patterns
        for (const { pattern, operation } of SQL_OPERATION_PATTERNS) {
            const matches = allChangedLines.matchAll(new RegExp(pattern));
            for (const match of matches) {
                hasDataLayerChanges = true;
                if (!riskEntry) {
                    riskEntry = { tables: new Set(), operations: new Set() };
                }
                riskEntry.operations.add(operation);
                if (match[1]) {
                    riskEntry.tables.add(match[1]);
                }
            }
        }
        // Check ORM patterns
        for (const { pattern, operation } of ORM_PATTERNS) {
            const matches = allChangedLines.matchAll(new RegExp(pattern));
            for (const match of matches) {
                hasDataLayerChanges = true;
                if (!riskEntry) {
                    riskEntry = { tables: new Set(), operations: new Set() };
                }
                riskEntry.operations.add(operation);
                if (match[1]) {
                    riskEntry.tables.add(match[1]);
                }
            }
        }
        if (hasDataLayerChanges && riskEntry) {
            fileRisksMap.set(hunk.file, riskEntry);
        }
    }
    // Convert map to array of DataLayerRisk
    for (const [file, { tables, operations }] of fileRisksMap) {
        if (operations.size > 0 || tables.size > 0) {
            risks.push({
                file,
                affectedTables: Array.from(tables),
                operations: Array.from(operations),
            });
        }
    }
    return risks;
}
//# sourceMappingURL=data-layer.js.map