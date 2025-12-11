{
  "nodes": [
    {
      "parameters": {
        "model": {
          "__rl": true,
          "value": "gpt-4o",
          "mode": "list",
          "cachedResultName": "gpt-4o"
        },
        "options": {}
      },
      "id": "f806da83-35df-4d37-a267-e3c0c8eb5222",
      "name": "LLM Table Selector1",
      "type": "@n8n/n8n-nodes-langchain.lmChatOpenAi",
      "typeVersion": 1.2,
      "position": [
        -1440,
        144
      ],
      "credentials": {
        "openAiApi": {
          "id": "rWng8HjwFzEyGRf0",
          "name": "text2sql"
        }
      }
    },
    {
      "parameters": {
        "promptType": "define",
        "text": "={{ $json.chatInput }}",
        "options": {
          "systemMessage": "=ROLE:\nYou are a database table selector. Your job is to identify ALL relevant tables needed to answer the user's question.\n\nCRITICAL RULES:\n\n1. COMPLETE SCAN REQUIRED:\n   - You MUST review EVERY single table in AVAILABLE TABLES before making selections\n   - Never stop scanning early or assume you've found everything\n   - Check each table's name, description, and comment field thoroughly\n\n2. RELEVANCE EVALUATION:\n   - PRIMARY relevance: Tables that directly contain the requested data or are essential for the query\n   - SECONDARY relevance: Tables needed for JOIN operations (bridge/junction/mapping tables)\n   - SUPPORTING relevance: Tables providing useful context, related metrics, or additional details\n   - Read table comments/descriptions carefully - they are the PRIMARY indicator of what data the table contains\n   - A table with a generic name but relevant description MUST be selected\n\n3. RELATIONSHIP DETECTION:\n   - If the question involves multiple entities (e.g., \"users and their orders\"), actively search for:\n     * Junction tables (e.g., user_orders, order_items)\n     * Mapping tables (e.g., user_role_mapping, product_category_mapping)\n     * Reference tables (e.g., status_codes, lookup_values)\n   - These connector tables are ESSENTIAL even if not explicitly mentioned in the question\n\n4. SELECTION LIMITS:\n   - Maximum: 10 tables\n   - If you identify more than 10 relevant tables, prioritize in this order:\n     a) PRIMARY tables (directly contain requested data)\n     b) SECONDARY tables (required for joins)\n     c) SUPPORTING tables (provide useful additional context)\n   - When under 10 tables and uncertain about a table's relevance, INCLUDE it\n\n5. EXCLUSIONS:\n   - Only exclude tables that are clearly unrelated to any aspect of the question\n   - Do NOT exclude tables just because they seem \"less important\" if they're still under the 10-table limit\n\n6. SPECIAL CASES TO WATCH FOR:\n   - Temporal queries: Include tables with date/time dimensions or historical data\n   - Aggregation queries: Include tables with metrics, counts, or summary data\n   - Hierarchical queries: Include tables with parent-child or category relationships\n   - Multi-step queries: Include intermediate tables needed for data transformation\n\nAVAILABLE TABLES:\n{{ $json.tableListText }}\n\nUSER QUESTION:\n{{ $json.chatInput }}\n\nREQUIRED OUTPUT FORMAT (valid JSON only):\n{\n  \"selected_tables\": [\"table1\", \"table2\", \"table3\"],\n  \"reasoning\": \"Detailed explanation organized as:\\n- PRIMARY: [list tables that directly answer the question]\\n- SECONDARY: [list junction/mapping tables needed for joins]\\n- SUPPORTING: [list tables providing additional context]\\n- EXCLUDED: [mention any borderline tables excluded and why]\",\n  \"confidence\": \"high/medium/low\",\n  \"table_count\": 3\n}\n\nIf NO relevant tables found:\n{\n  \"selected_tables\": [],\n  \"reasoning\": \"No tables in the available schema contain data relevant to: [restate user question]. Searched all tables including [mention a few table names to prove you scanned].\",\n  \"confidence\": \"high\",\n  \"table_count\": 0\n}\n\nIMPORTANT REMINDERS:\n- Scan EVERY table before deciding\n- Prioritize table descriptions/comments over table names\n- When in doubt and under 10 tables, INCLUDE the table\n- Always look for connector/mapping tables between entities\n- Your goal is COMPLETENESS within the 10-table limit"
        }
      },
      "id": "42da2f8f-8793-4349-8640-a2c4a7c2191b",
      "name": "Select Relevant Tables1",
      "type": "@n8n/n8n-nodes-langchain.agent",
      "typeVersion": 2.2,
      "position": [
        -1424,
        -96
      ]
    },
    {
      "parameters": {
        "jsCode": "// 1. Get the raw output from the LLM\nlet rawOutput = '';\n\nif ($json.text) {\n  rawOutput = $json.text;\n} else if ($json.output) {\n  rawOutput = $json.output;\n} else if (typeof $json === 'string') {\n  rawOutput = $json;\n} else {\n  rawOutput = JSON.stringify($json);\n}\n\nlet response;\n\ntry {\n  // 2. Parse the JSON from the LLM\n  const jsonMatch = rawOutput.match(/\\{[\\s\\S]*\\}/);\n  if (!jsonMatch) {\n    throw new Error('No JSON found in LLM response');\n  }\n  \n  response = JSON.parse(jsonMatch[0]);\n  \n  const selectedTables = response.selected_tables || [];\n  const reasoning = response.reasoning || 'No reasoning provided';\n  const confidence = response.confidence || 'unknown';\n  \n  // 3. Basic Validation\n  if (!Array.isArray(selectedTables)) {\n    throw new Error('selected_tables is not an array');\n  }\n  \n  if (selectedTables.length === 0) {\n    throw new Error('No relevant tables found for this query');\n  }\n  \n  if (selectedTables.length > 10) {\n    throw new Error(`Too many tables selected (${selectedTables.length}). Maximum is 10.`);\n  }\n  \n  // 4. Validate table names against the real database list\n  let availableTables = [];\n  try {\n    // Look back at the \"Format Table List\" node for the master list\n    availableTables = $('Format Table List').first().json.tableNames;\n  } catch (e) {\n    console.warn('Cannot access Format Table List - skipping validation');\n    availableTables = selectedTables;\n  }\n  \n  if (availableTables && Array.isArray(availableTables) && availableTables.length > 0) {\n    const invalidTables = selectedTables.filter(t => !availableTables.includes(t));\n    \n    if (invalidTables.length > 0) {\n      throw new Error(`Invalid table names: ${invalidTables.join(', ')}`);\n    }\n  }\n  \n  // 5. Retrieve the User Query (chatInput) from the upstream node\n  // We grab it from \"Format Table List\" so we don't have to look at the Webhook again\n  let chatInput = 'unknown query';\n  let databaseName = 'myvyaydev';\n  \n  try {\n    const upstreamData = $('Format Table List').first().json;\n    chatInput = upstreamData.chatInput;\n    databaseName = upstreamData.databaseName;\n  } catch (e) {\n    console.warn('Cannot access Format Table List for context');\n  }\n  \n  const tableNamesForSQL = selectedTables.map(t => `'${t}'`).join(', ');\n  \n  return [{\n    json: {\n      selectedTables: selectedTables,\n      tableCount: selectedTables.length,\n      reasoning: reasoning,\n      confidence: confidence,\n      chatInput: chatInput,\n      databaseName: databaseName,\n      tableNamesForSQL: tableNamesForSQL\n    }\n  }];\n  \n} catch (err) {\n  throw new Error(`Table selection validation failed: ${err.message}`);\n}"
      },
      "id": "ca29a71e-a5ce-4c3e-9b3e-a059fe8cc34c",
      "name": "Validate Table Selection1",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -1104,
        -80
      ]
    },
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "SELECT \n    c.TABLE_SCHEMA,\n    c.TABLE_NAME,\n    c.COLUMN_NAME,\n    c.DATA_TYPE,\n    c.IS_NULLABLE,\n    c.COLUMN_KEY,\n    c.COLUMN_COMMENT,\n    t.TABLE_COMMENT\nFROM INFORMATION_SCHEMA.COLUMNS c\nJOIN INFORMATION_SCHEMA.TABLES t\n    ON c.TABLE_SCHEMA = t.TABLE_SCHEMA\n    AND c.TABLE_NAME = t.TABLE_NAME\nWHERE c.TABLE_SCHEMA = '{{ $('Validate Table Selection1').item.json.databaseName }}'\n  AND c.TABLE_NAME IN ({{ $('Validate Table Selection1').item.json.tableNamesForSQL }})\nORDER BY c.TABLE_NAME, c.ORDINAL_POSITION;",
        "options": {}
      },
      "id": "43b7b9c3-da5c-4871-bfff-fbbb844def3a",
      "name": "Read Filtered Schema1",
      "type": "n8n-nodes-base.mySql",
      "typeVersion": 2.5,
      "position": [
        -928,
        -80
      ],
      "credentials": {
        "mySql": {
          "id": "RDuihR42NYbiVcxZ",
          "name": "MySQL account"
        }
      }
    },
    {
      "parameters": {
        "jsCode": "const rows = $input.all();\nconst schemaData = rows.map(r => r.json);\n\nif (schemaData.length === 0) {\n  throw new Error('No schema data retrieved for selected tables');\n}\n\nconst tableMap = {};\nconst databaseName = schemaData[0]?.TABLE_SCHEMA || 'unknown';\n\nschemaData.forEach(col => {\n  const tableName = col.TABLE_NAME;\n  if (!tableMap[tableName]) {\n    tableMap[tableName] = {\n      table_name: tableName,\n      table_comment: col.TABLE_COMMENT,\n      columns: []\n    };\n  }\n  tableMap[tableName].columns.push({\n    name: col.COLUMN_NAME,\n    type: col.DATA_TYPE,\n    nullable: col.IS_NULLABLE,\n    key: col.COLUMN_KEY,\n    comment: col.COLUMN_COMMENT\n  });\n});\n\nconst structuredSchema = Object.values(tableMap);\nconst availableTables = Object.keys(tableMap);\nconst schemaText = JSON.stringify(structuredSchema, null, 2);\n\n// Get context from earlier nodes\nconst formatData = $('Format Table List').first().json;\nconst validationData = $('Validate Table Selection1').first().json;\n\nreturn [{ \n  json: { \n    schemaText, \n    chatInput: formatData.chatInput,\n    databaseName,\n    availableTables: availableTables.join(', '),\n    tableCount: availableTables.length,\n    tableSelectionReasoning: validationData.reasoning,\n    columnCount: schemaData.length,\n    // Pass through modification context for agent routing\n    requestType: formatData.requestType,\n    lastSQL: formatData.lastSQL,\n    lastExplanation: formatData.lastExplanation,\n    lastRowCount: formatData.lastRowCount\n  } \n}];\n"
      },
      "id": "e40c09ce-fce0-475f-894d-50ed067beacb",
      "name": "Build Filtered Schema JSON1",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -736,
        -80
      ]
    },
    {
      "parameters": {
        "model": {
          "__rl": true,
          "value": "gpt-4o",
          "mode": "list",
          "cachedResultName": "gpt-4o"
        },
        "options": {}
      },
      "id": "b4a5b7b3-ec94-43f4-b028-18d022710673",
      "name": "Generate SQL (LLM)1",
      "type": "@n8n/n8n-nodes-langchain.lmChatOpenAi",
      "typeVersion": 1.2,
      "position": [
        -304,
        176
      ],
      "credentials": {
        "openAiApi": {
          "id": "rWng8HjwFzEyGRf0",
          "name": "text2sql"
        }
      }
    },
    {
      "parameters": {
        "promptType": "define",
        "text": "={{ $json.chatInput }}",
        "options": {
          "systemMessage": "=ROLE:\nYou are an Expert MySQL Data Analyst. You write high-performance, complex SQL queries to answer business questions.\n\nINPUT CONTEXT:\n- Database Schema: {{ $json.schemaText }}\n- Available Tables: {{ $json.availableTables }}\n- User Question: {{ $json.chatInput }}\n\nGUIDELINES FOR COMPLEX QUERIES:\n1. STRATEGY & JOINS:\n   EXPLICIT JOIN TYPES ONLY: You MUST use `INNER JOIN`, `LEFT JOIN`, or `RIGHT JOIN`.\n   - FORBIDDEN: Do NOT use the generic `JOIN` keyword alone. Do NOT use comma-separated joins (e.g. `FROM table1, table2`).\n   - USE ALIASES: Always use clear short aliases (e.g., `FROM employees e LEFT JOIN departments d ON e.dept_id = d.id`).\n   - LOGIC: Prefer `LEFT JOIN` over `INNER JOIN` if the user wants to see all records from the primary entity (e.g. \"Show all users and their orders\" -> users without orders should still appear)\n\n2. AGGREGATION & METRICS:\n   - If the user asks for \"Total\", \"Count\", \"Average\", or \"Per [Category]\", you MUST use `GROUP BY`.\n   - Example: \"Sales per Month\" -> `SELECT DATE_FORMAT(order_date, '%Y-%m') as Month, SUM(amount) ... GROUP BY 1`.\n   - Always include the column you are grouping by in the SELECT clause.\n\n3. DATE HANDLING:\n   - For \"this month/year\", use dynamic functions: `WHERE year(date_col) = YEAR(CURDATE())`.\n   - Do not hardcode years (like '2023') unless explicitly asked.\n\n4. HANDLING AMBIGUITY:\n   - If a column name appears in multiple tables (e.g., `name`, `id`, `created_at`), you MUST prefix it with the table alias (e.g., `u.name` not just `name`).\n   - If the user asks for \"Show me users\", select distinct meaningful columns (ID, Name, Email) rather than `SELECT *`.\n\n5. STEP-BY-STEP REASONING (Internal):\n   - Step 1: Identify which table holds the main metric.\n   - Step 2: Identify which tables hold the dimensions (names, categories).\n   - Step 3: Determine the Join Keys (Foreign Keys).\n   - Step 4: Write the SQL.\n\n6. EMPLOYEE NAME FILTERING:\n   - If the user mentions an employee by a single name (e.g. \"dummy\"), do NOT assume it is only the first_name.\n   - When filtering employees by name, match against:\n     - first_name\n     - last_name\n     - CONCAT_WS(' ', first_name, last_name)\n   Example:\n   WHERE \n       e.first_name = 'dummy'\n       OR e.last_name = 'dummy'\n       OR CONCAT_WS(' ', e.first_name, e.last_name) = 'dummy'\n\n\n7. ELABORATION HANDLING:\n   {{ $json.requestType === 'elaboration' ? '- This is an elaboration - the previous query returned 0 rows\\n   - Analyze the previous SQL: ' + ($json.lastSQL || '') + '\\n   - Common issues to check: overly restrictive WHERE conditions, incorrect date formats, wrong table joins, missing LIKE wildcards for text searches\\n   - Use the new information from the user to fix the issue\\n   - In your explanation, state what you believe went wrong and how you fixed it\\n   - Be more permissive with filters if the user is clarifying (e.g., use LIKE instead of =, or broaden date ranges)' : '- Generate a fresh query based on the user question' }}\n\n8. DO NOT ADD EXTRA LOGIC:\n   - Do not add extra joins, columns, or logic unless the user specifically asks for them.\n   - Keep the query focused on answering exactly what was asked.\n\n9.You MUST NOT include \\n or any newline characters in the SQL query.Always return the SQL as one single-line string.\nExample (correct):\n\"SELECT id, name FROM employees WHERE status = 'active';\"\n\n\nOUTPUT FORMAT (JSON ONLY):\n{\n  \"sql_query\": \"SELECT ...\",\n  \"explanation\": \"I joined table X and Y using id. I grouped by Z to calculate the total...\",\n  \"tables_used\": [\"tableX\", \"tableY\"],\n  \"confidence\": \"high\"\n}\n\nERROR HANDLING:\nIf the User Question asks for data not present in the Schema, return:\n{\n  \"sql_query\": \"ERROR\",\n  \"message\": \"The requested data (specifically [missing concept]) is not found in the provided schema.\",\n  \"available_tables\": [...]\n}"
        }
      },
      "id": "8dd6232b-770c-4516-bce7-450c65fe3a1f",
      "name": "Universal SQL Agent1",
      "type": "@n8n/n8n-nodes-langchain.agent",
      "typeVersion": 2.2,
      "position": [
        -304,
        -80
      ]
    },
    {
      "parameters": {
        "jsCode": "// ---------- 1) Robust rawOutput extraction ----------\nlet rawOutput = '';\n\nif ($json.text) {\n  rawOutput = typeof $json.text === 'string'\n    ? $json.text\n    : JSON.stringify($json.text);\n} else if ($json.output) {\n  rawOutput = typeof $json.output === 'string'\n    ? $json.output\n    : JSON.stringify($json.output);\n} else if (typeof $json === 'string') {\n  rawOutput = $json;\n} else {\n  rawOutput = JSON.stringify($json);\n}\n\n// Strip Markdown code fences if the LLM wrapped the JSON in ```json ... ```\nrawOutput = rawOutput.replace(/```[a-zA-Z]*\\n?([\\s\\S]*?)```/g, '$1').trim();\n\n// ---------- 2) Helper: safe JSON.parse with backslash repair ----------\nfunction safeJsonParse(text) {\n  // First try normal parse\n  try {\n    return JSON.parse(text);\n  } catch (err) {\n    // If it fails, attempt to fix invalid escape sequences like \\S, \\d, C:\\...\n    const fixed = text.replace(/\\\\(?![\"\\\\/bfnrtu])/g, '\\\\\\\\');\n    return JSON.parse(fixed);\n  }\n}\n\n// ---------- 3) Extract JSON object substring from rawOutput ----------\nlet response;\n\ntry {\n  // Greedy match of first {...} block\n  const jsonMatch = rawOutput.match(/\\{[\\s\\S]*\\}/);\n  if (!jsonMatch) {\n    throw new Error('No JSON found in response');\n  }\n\n  const jsonText = jsonMatch[0];\n\n  // Parse with safeJsonParse\n  response = safeJsonParse(jsonText);\n} catch (err) {\n  throw new Error(`SQL validation failed: Bad JSON from LLM: ${err.message}`);\n}\n\n// ---------- 4) Validate structure ----------\nif (!response || typeof response !== 'object') {\n  throw new Error('SQL validation failed: Parsed response is not an object');\n}\n\nif (response.sql_query === 'ERROR' || response.error_type) {\n  // Model is explicitly signalling an error\n  return [{\n    json: {\n      error: true,\n      message: response.message || 'Schema validation failed',\n      suggestions: response.suggestions || [],\n      missingEntities: response.missing_entities || [],\n    },\n  }];\n}\n\nif (!response.sql_query || typeof response.sql_query !== 'string') {\n  throw new Error('SQL validation failed: sql_query missing or not a string');\n}\n\n// ---------- 5) Safety checks on the SQL ----------\nlet sqlQuery = response.sql_query;\nconst queryUpper = sqlQuery.toUpperCase();\n\n// Only block real SQL commands, not column names\nconst dangerousPatterns = [\n  /\\bINSERT\\s+INTO\\b/i,                           // INSERT INTO table\n  /\\bUPDATE\\s+\\w+\\s+SET\\b/i,                      // UPDATE table SET\n  /\\bDELETE\\s+FROM\\b/i,                           // DELETE FROM table\n  /\\bDROP\\s+(TABLE|DATABASE|INDEX|VIEW)\\b/i,      // DROP TABLE/DATABASE/etc\n  /\\bALTER\\s+(TABLE|DATABASE)\\b/i,                // ALTER TABLE/DATABASE\n  /\\bCREATE\\s+(TABLE|DATABASE|INDEX|VIEW)\\b/i,    // CREATE TABLE/etc\n  /\\bTRUNCATE\\s+TABLE\\b/i,                        // TRUNCATE TABLE\n  /\\bREPLACE\\s+INTO\\b/i,                          // REPLACE INTO\n  /\\bMERGE\\s+INTO\\b/i,                            // MERGE INTO\n  /\\bEXEC(UTE)?\\s*\\(/i,                           // EXEC( or EXECUTE(\n  /\\bGRANT\\s+/i,                                  // GRANT\n  /\\bREVOKE\\s+/i                                  // REVOKE\n];\n\n// Check for dangerous patterns\nfor (const pattern of dangerousPatterns) {\n  if (pattern.test(sqlQuery)) {\n    const match = sqlQuery.match(pattern);\n    throw new Error(`SQL validation failed: Blocked unsafe SQL operation: ${match[0]}`);\n  }\n}\n\n// Query must start with SELECT (ignoring whitespace)\nif (!queryUpper.trim().startsWith('SELECT')) {\n  throw new Error('SQL validation failed: Only SELECT queries are allowed');\n}\n\n// AUTO-FIX: Add LIMIT if missing, to cap result size\nif (!queryUpper.includes('LIMIT')) {\n  sqlQuery = sqlQuery.trim();\n  if (sqlQuery.endsWith(';')) {\n    sqlQuery = sqlQuery.slice(0, -1) + ' LIMIT 100;';\n  } else {\n    sqlQuery += ' LIMIT 100';\n  }\n}\n\n// ---------- 6) Final output ----------\nreturn [{\n  json: {\n    sqlQuery,\n    explanation: response.explanation || '',\n    tablesUsed: response.tables_used || [],\n    confidence: response.confidence || 'unknown',\n    autoAddedLimit: !queryUpper.includes('LIMIT'),\n  },\n}];\n"
      },
      "id": "09979d27-30b5-4b1b-85d4-b4fbdadd0cae",
      "name": "Validate SQL Safety1",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        16,
        -80
      ]
    },
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "{{ $json.sqlQuery }}",
        "options": {}
      },
      "id": "82c8e563-0d76-4740-8116-fbe5ddd00386",
      "name": "Execute Generated SQL1",
      "type": "n8n-nodes-base.mySql",
      "typeVersion": 2.5,
      "position": [
        208,
        -80
      ],
      "alwaysOutputData": true,
      "credentials": {
        "mySql": {
          "id": "RDuihR42NYbiVcxZ",
          "name": "MySQL account"
        }
      }
    },
    {
      "parameters": {
        "conditions": {
          "options": {
            "caseSensitive": true,
            "leftValue": "",
            "typeValidation": "strict",
            "version": 2
          },
          "conditions": [
            {
              "id": "12e5fdff-2fa0-408e-b382-ee336cd03cd4",
              "leftValue": "={{ $json.rowCount }}",
              "rightValue": 0,
              "operator": {
                "type": "number",
                "operation": "equals"
              }
            }
          ],
          "combinator": "and"
        },
        "options": {}
      },
      "type": "n8n-nodes-base.if",
      "typeVersion": 2.2,
      "position": [
        608,
        -80
      ],
      "id": "977bac89-985e-420e-9355-6f6f2115046e",
      "name": "If"
    },
    {
      "parameters": {
        "jsCode": "const items = $input.all();\n\n// Case 1: absolutely no items\nif (items.length === 0) {\n  return [{\n    json: {\n      hasRows: false,\n      rowCount: 0,\n    }\n  }];\n}\n\n// Case 2: n8n returns 1 “empty” item because of alwaysOutputData\nconst firstJson = items[0].json || {};\nconst isEmptyObject = Object.keys(firstJson).length === 0;\n\n// If first item has no columns, treat as no rows\nif (isEmptyObject) {\n  return [{\n    json: {\n      hasRows: false,\n      rowCount: 0,\n    }\n  }];\n}\n\n// Normal case: there *are* rows\nreturn [{\n  json: {\n    hasRows: true,\n    rowCount: items.length,\n    rows: items.map(i => i.json),\n  }\n}];\n"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        448,
        -80
      ],
      "id": "92dc1572-60fd-4422-9826-0b2a5afa9183",
      "name": "Code in JavaScript"
    },
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ JSON.stringify($json) }}\n",
        "options": {}
      },
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.4,
      "position": [
        1120,
        -80
      ],
      "id": "cfa1c54f-4eef-4796-a150-073052a34fc2",
      "name": "Respond to Webhook"
    },
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "6700ffbc-052a-44f8-99f3-ece432c4b975",
        "responseMode": "responseNode",
        "options": {}
      },
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2.1,
      "position": [
        -2288,
        -80
      ],
      "id": "e8803df5-97a2-4413-9e09-e5f37c00bcf2",
      "name": "Webhook",
      "webhookId": "6700ffbc-052a-44f8-99f3-ece432c4b975"
    },
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "SELECT \n    TABLE_NAME,\n    TABLE_COMMENT,\n    TABLE_ROWS\nFROM INFORMATION_SCHEMA.TABLES\nWHERE TABLE_SCHEMA =  \"myvyaydev\"\n  AND TABLE_TYPE = 'BASE TABLE'\nORDER BY TABLE_NAME;\n",
        "options": {}
      },
      "id": "8e2460d6-db72-4a37-804d-a144f73ddcb1",
      "name": "Read Table List Only",
      "type": "n8n-nodes-base.mySql",
      "typeVersion": 2.5,
      "position": [
        -1872,
        -80
      ],
      "credentials": {
        "mySql": {
          "id": "RDuihR42NYbiVcxZ",
          "name": "MySQL account"
        }
      }
    },
    {
      "parameters": {
        "jsCode": "// 1. Format the table list (existing logic)\nconst tables = $input.all().map(item => ({\n  name: item.json.TABLE_NAME,\n  comment: item.json.TABLE_COMMENT || 'No description',\n  row_count: item.json.TABLE_ROWS || 0\n}));\n\nconst tableListText = tables.map(t => \n  `- ${t.name}: ${t.comment} (${t.row_count} rows)`\n).join('\\n');\n\n// 2. Get context from \"Detect Request Type\"\nlet detectionData = {\n  requestType: 'normal',\n  userQuery: 'show me all data',\n  lastSQL: null,\n  lastTablesUsed: null,\n  databaseName: 'myvyaydev'\n};\n\ntry {\n  detectionData = $('Code in JavaScript2').first().json;\n} catch (e) {\n  console.warn('Could not get detection data');\n}\n\n// 3. For modifications, suggest tables from previous query\nlet suggestedTables = [];\nif (detectionData.requestType === 'modification' && detectionData.lastTablesUsed) {\n  // Filter to only tables that exist in current database\n  suggestedTables = detectionData.lastTablesUsed.filter(t => \n    tables.some(dbTable => dbTable.name === t)\n  );\n}\n\nreturn [{\n  json: {\n    tableListText,\n    tableNames: tables.map(t => t.name),\n    chatInput: detectionData.userQuery,\n    databaseName: detectionData.databaseName,\n    totalTables: tables.length,\n    // Pass through modification context\n    requestType: detectionData.requestType,\n    lastSQL: detectionData.lastSQL,\n    lastExplanation: detectionData.lastExplanation,\n    lastRowCount: detectionData.lastRowCount,\n    suggestedTables: suggestedTables.length > 0 ? suggestedTables : null\n  }\n}];\n\n\n"
      },
      "id": "5f37e310-2079-40d3-adbb-a12388dde483",
      "name": "Format Table List",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -1648,
        -80
      ]
    },
    {
      "parameters": {
        "jsCode": "// Get all input items\nconst items = $input.all();\n\n// Initialize response structure\nlet response = {\n  status: \"success\",\n  message: \"\",\n  data: {\n    rowCount: 0,\n    rows: [],\n    sqlQuery: \"\",\n    explanation: \"\",\n    tablesUsed: []\n  }\n};\n\n// Get SQL query details from earlier node\ntry {\n  const sqlData = $('Validate SQL Safety1').first().json;\n  response.data.sqlQuery = sqlData.sqlQuery || \"\";\n  response.data.explanation = sqlData.explanation || \"\";\n  response.data.tablesUsed = sqlData.tablesUsed || [];\n} catch (e) {\n  console.warn(\"Could not get SQL details:\", e.message);\n}\n\n// Check if we have data from the \"Code in JavaScript\" node\nif (items.length > 0) {\n  const firstItem = items[0].json;\n  \n  if (firstItem.hasRows === false || firstItem.rowCount === 0) {\n    // No results case\n    response.message = \"Query executed successfully but returned no results\";\n    response.data.rowCount = 0;\n    response.data.rows = [];\n  } else {\n    // Has results case\n    response.message = `Query executed successfully. Found ${firstItem.rowCount} result(s)`;\n    response.data.rowCount = firstItem.rowCount;\n    response.data.rows = firstItem.rows || [];\n  }\n} else {\n  // Fallback: no items at all\n  response.status = \"error\";\n  response.message = \"No data received from query execution\";\n}\n\nreturn [{\n  json: response\n}];"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        864,
        -80
      ],
      "id": "2f41c5d8-9e3a-47c6-ae0b-fe3f3d3995c0",
      "name": "Code in JavaScript1"
    },
    {
      "parameters": {
        "jsCode": "const webhookData = $json.body;\n\n// Try multiple possible field names for the user query\nconst userQuery = webhookData.query \n  || webhookData.chatInput \n  || webhookData.text \n  || webhookData.message \n  || '';\n\nconst history = webhookData.conversation_history \n  || webhookData.history \n  || [];\n\n// Validation - fail fast if no query\nif (!userQuery || userQuery.trim() === '') {\n  throw new Error('No user query found in webhook payload. Received: ' + JSON.stringify(webhookData));\n}\n\nconsole.log('=== WEBHOOK DATA ===');\nconsole.log('User Query:', userQuery);\nconsole.log('History length:', history.length);\nconsole.log('Full payload keys:', Object.keys(webhookData));\nconsole.log('====================');\n\n// Extract last assistant response (contains SQL if exists)\nlet lastSQL = null;\nlet lastExplanation = null;\nlet lastRowCount = null;\nlet lastTablesUsed = [];\n\n// FIXED: Look through history backwards for last assistant message with SQL\nfor (let i = history.length - 1; i >= 0; i--) {\n  const msg = history[i];\n  if (msg.role === 'assistant') {\n    // Direct access to structured data (no regex parsing needed)\n    if (msg.sql_query) {\n      lastSQL = msg.sql_query;\n    }\n    \n    // Get row count from rows array\n    if (msg.rows !== undefined) {\n      lastRowCount = Array.isArray(msg.rows) ? msg.rows.length : 0;\n    }\n    \n    // Try to extract explanation from content\n    if (msg.content) {\n      const explMatch = msg.content.match(/\\*\\*Explanation:\\*\\*\\s*\\n(.*?)(?:\\n\\*\\*|$)/s);\n      if (explMatch) {\n        lastExplanation = explMatch[1].trim();\n      }\n      \n      // Extract tables used\n      const tablesMatch = msg.content.match(/\\*\\*Tables Used:\\*\\*\\s*`(.*?)`/);\n      if (tablesMatch) {\n        lastTablesUsed = tablesMatch[1].split(',').map(t => t.trim());\n      }\n    }\n    \n    // If we found SQL, we're done\n    if (lastSQL) break;\n  }\n}\n\n// ENHANCED MODIFICATION DETECTION\nlet requestType = 'normal';\nlet reasoning = '';\n\nconst queryLower = userQuery.toLowerCase().trim();\n\n// MODIFICATION DETECTION PATTERNS\nconst modificationKeywords = [\n  'add column', 'remove column', 'change filter', 'modify', 'update query',\n  'also include', 'also add', 'also show', 'exclude', 'add where', 'remove where', \n  'change limit', 'order by', 'group by', 'add join', 'add condition', \n  'remove condition', 'change date', 'filter by', 'sort by', \n  'don\\'t show', 'instead of', 'replace', 'use different',\n  'change to', 'update to', 'add filter', 'remove filter',\n  'show me also', 'include also', 'with also', 'along with',\n  'and also', 'plus', 'as well', 'too', 'additionally',\n  'only show', 'just show', 'limit to', 'restrict to',\n  'without', 'except', 'excluding', 'not including'\n];\n\nconst referentialPhrases = [\n  'the query', 'the sql', 'the result', 'the table', 'previous', \n  'last query', 'current query', 'this query', 'that column', \n  'those rows', 'these results', 'same query', 'above query',\n  'same but', 'that but', 'previous but'\n];\n\n// Check for modification keywords\nconst hasModificationKeyword = modificationKeywords.some(kw => \n  queryLower.includes(kw)\n);\n\n// Check for referential phrases\nconst hasReferentialPhrase = referentialPhrases.some(phrase => \n  queryLower.includes(phrase)\n);\n\n// Additional modification patterns\nconst startsWithModificationWord = /^(also|add|include|show|plus|and|with|remove|exclude|change|modify|update|sort|order|filter|limit|only|just)/i.test(queryLower);\n\n// Check if query is very short and likely a continuation\nconst isShortContinuation = userQuery.split(' ').length <= 5 && lastSQL !== null;\n\n// Decision tree\nif (lastSQL) {\n  if (hasModificationKeyword || hasReferentialPhrase || startsWithModificationWord) {\n    requestType = 'modification';\n    reasoning = `User is modifying previous query. Detected: ${\n      hasModificationKeyword ? 'modification keyword (' + modificationKeywords.find(kw => queryLower.includes(kw)) + ')' : \n      hasReferentialPhrase ? 'referential phrase' : \n      'modification pattern at start'\n    }`;\n  } else if (lastRowCount === 0) {\n    requestType = 'elaboration';\n    reasoning = 'Previous query returned 0 rows - treating as elaboration';\n  } else if (isShortContinuation) {\n    requestType = 'modification';\n    reasoning = 'Short query following a previous query - likely a modification';\n  } else {\n    requestType = 'normal';\n    reasoning = 'New independent query';\n  }\n} else {\n  requestType = 'normal';\n  reasoning = 'First query in conversation';\n}\n\n// Debug logging\nconsole.log('=== DETECTION DEBUG ===');\nconsole.log('User Query:', userQuery);\nconsole.log('Query Length:', userQuery.length);\nconsole.log('Last SQL exists:', !!lastSQL);\nconsole.log('Last SQL preview:', lastSQL ? lastSQL.substring(0, 50) + '...' : 'none');\nconsole.log('Last Row Count:', lastRowCount);\nconsole.log('Has Modification Keyword:', hasModificationKeyword);\nconsole.log('Has Referential Phrase:', hasReferentialPhrase);\nconsole.log('Starts With Modification Word:', startsWithModificationWord);\nconsole.log('Is Short Continuation:', isShortContinuation);\nconsole.log('FINAL DETECTED TYPE:', requestType);\nconsole.log('REASONING:', reasoning);\nconsole.log('======================');\n\nreturn [{\n  json: {\n    requestType,\n    reasoning,\n    userQuery,\n    lastSQL: lastSQL || null,\n    lastExplanation: lastExplanation || null,\n    lastRowCount: lastRowCount !== null ? lastRowCount : null,\n    lastTablesUsed: lastTablesUsed.length > 0 ? lastTablesUsed : null,\n    databaseName: 'myvyaydev',\n    conversationHistory: history\n  }\n}];"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -2080,
        -80
      ],
      "id": "6168a957-4f4f-4e53-b94d-dec566159e84",
      "name": "Code in JavaScript2"
    },
    {
      "parameters": {
        "conditions": {
          "options": {
            "caseSensitive": true,
            "leftValue": "",
            "typeValidation": "strict",
            "version": 2
          },
          "conditions": [
            {
              "id": "381041b3-9ee1-4529-90e1-8d7fdb5dbc5a",
              "leftValue": "={{ $json.requestType }}",
              "rightValue": "modification",
              "operator": {
                "type": "string",
                "operation": "equals",
                "name": "filter.operator.equals"
              }
            }
          ],
          "combinator": "and"
        },
        "options": {}
      },
      "type": "n8n-nodes-base.if",
      "typeVersion": 2.2,
      "position": [
        -528,
        -80
      ],
      "id": "e37b688e-c7dd-4684-82a6-70330445be97",
      "name": "If1"
    },
    {
      "parameters": {
        "options": {
          "systemMessage": "=ROLE:\nYou are a SQL Query Modifier. You take an existing SQL query and modify it based on the user's request.\n\nINPUT CONTEXT:\n\nORIGINAL SQL QUERY:\n{{ $json.lastSQL || 'ERROR: No previous SQL query found' }}\n\nDATABASE SCHEMA (for reference):\n{{ $json.schemaText }}\n\nAVAILABLE TABLES: {{ $json.availableTables }}\n\nUSER'S MODIFICATION REQUEST: {{ $json.chatInput }}\n\nCRITICAL RULES:\n\n1. MODIFICATION ONLY - DO NOT REWRITE FROM SCRATCH:\n   - START with the original SQL shown above\n   - Make ONLY the changes the user requested\n   - Preserve ALL other logic: joins, filters, grouping, ordering that were NOT mentioned\n   - Think of this as \"patching\" not \"rebuilding\"\n   - If you change something the user didn't ask to change, you are doing it WRONG\n\n2. STRICT COLUMN AND TABLE VALIDATION:\n   ⚠️ ABSOLUTE REQUIREMENT - VIOLATION = IMMEDIATE ERROR:\n   \n   A. COLUMN NAMES:\n      - You MUST use EXACT column names from the schema\n      - DO NOT create, infer, or assume column names\n      - DO NOT use common/logical names like \"name\", \"department_name\", \"email\" unless they EXACTLY exist in the schema\n      - DO NOT use variations like \"dept_name\" when schema has \"department_name\"\n      - If user asks for \"department\" but schema has \"dept_id\", you MUST use \"dept_id\"\n      - If a column doesn't exist, RETURN ERROR - do NOT proceed\n   \n   B. TABLE NAMES:\n      - You MUST use EXACT table names from AVAILABLE TABLES list\n      - DO NOT assume table names like \"departments\", \"users\", \"orders\" exist\n      - If table doesn't exist in AVAILABLE TABLES, RETURN ERROR\n   \n   C. VALIDATION PROCESS (MANDATORY BEFORE OUTPUT):\n      Step 1: Extract column name from user request\n      Step 2: Search for EXACT match in schema\n      Step 3: If NOT found, search for similar names and suggest in error\n      Step 4: If found, use the EXACT name with proper table alias\n      \n   D. EXAMPLES OF VIOLATIONS (DO NOT DO THIS):\n      ❌ User asks \"add email\" → You use \"e.email\" (but schema has \"email_address\")\n      ❌ User asks \"show department\" → You use \"d.department_name\" (but table has \"dept_name\")\n      ❌ User asks \"add phone\" → You use \"phone_number\" (but schema has \"contact_phone\")\n      ❌ User add join to \"departments\" (but AVAILABLE TABLES only has \"dept\")\n      \n   E. CORRECT APPROACH:\n      ✅ User asks \"add email\" → Check schema → Found \"email_address\" → Use \"e.email_address\"\n      ✅ User asks \"show department\" → Check schema → Found \"dept_name\" → Use \"d.dept_name\"\n      ✅ User asks \"add phone\" → Check schema → NOT found → Return ERROR with suggestion\n      ✅ User wants departments → Check AVAILABLE TABLES → Found \"dept\" → Use \"dept\" table\n\n3. COMMON MODIFICATION PATTERNS:\n\n   A. ADD COLUMNS:\n      - FIRST: Verify column exists in schema (EXACT name match)\n      - SECOND: Determine which table contains this column\n      - THIRD: If column is from a new table, add appropriate JOIN\n      - FOURTH: Add column to SELECT with proper table alias\n      - Example: User says \"also show department name\"\n        → Check schema for \"department_name\" column\n        → If found in \"departments\" table → Add LEFT JOIN departments d\n        → Add d.department_name to SELECT\n        → If NOT found, check for alternatives: \"dept_name\", \"name\" in dept-related tables\n        → If still NOT found, RETURN ERROR\n      - Use LEFT JOIN by default to preserve all rows from the main table\n\n   B. REMOVE COLUMNS:\n      - Remove from SELECT clause only\n      - Keep the JOIN if other columns from that table are still needed\n      - Remove the JOIN only if NO columns from that table remain in SELECT\n\n   C. ADD FILTERS:\n      - FIRST: Verify column exists in schema\n      - SECOND: Add to WHERE clause using AND (unless user says \"or\")\n      - Example: \"also filter by status = 'Active'\"\n        → Check schema for \"status\" column\n        → If found, add AND status = 'Active'\n        → If NOT found, suggest alternatives like \"status_code\", \"employee_status\"\n      - Place new condition in logical position\n\n   D. REMOVE FILTERS:\n      - Remove specific condition from WHERE clause\n      - Adjust AND/OR logic accordingly\n      - Be careful not to break the remaining WHERE clause structure\n\n   E. CHANGE SORTING:\n      - FIRST: Verify sort column exists in schema\n      - SECOND: Modify ORDER BY clause\n      - Add ORDER BY if it doesn't exist\n      - Example: \"sort by salary descending\"\n        → Check schema for \"salary\" column\n        → If found, add ORDER BY salary DESC\n        → If NOT found, check for \"annual_salary\", \"base_salary\", etc.\n\n   F. CHANGE GROUPING:\n      - FIRST: Verify group-by column exists in schema\n      - SECOND: Modify GROUP BY clause\n      - Ensure SELECT clause has proper aggregations if using GROUP BY\n      - Add aggregate functions (SUM, COUNT, AVG) if needed\n\n   G. CHANGE LIMIT:\n      - Modify LIMIT value\n      - Example: \"show only 10\" means change LIMIT to 10\n\n   H. ADD JOINS:\n      - FIRST: Verify target table exists in AVAILABLE TABLES\n      - SECOND: Verify join columns exist in both tables\n      - THIRD: Add new JOIN clause with proper ON condition\n      - Use LEFT JOIN by default unless user specifies INNER JOIN\n      - Ensure the join key exists in both tables\n\n4. SQL SYNTAX REQUIREMENTS:\n   - Use EXPLICIT JOIN types: INNER JOIN, LEFT JOIN, RIGHT JOIN (NEVER generic \"JOIN\")\n   - Always use table aliases (e.g., e for employees, d for departments)\n   - Prefix ambiguous columns with table alias (e.g., e.name, not just name)\n   - Use MySQL date functions: DATE_FORMAT(), YEAR(), CURDATE(), NOW(), etc.\n   - Maintain consistent formatting (indentation, capitalization)\n\n5. MANDATORY PRE-OUTPUT VALIDATION CHECKLIST:\n   Before generating output, you MUST verify:\n   \n   ✓ Every column name in SELECT exists in schema (exact match)\n   ✓ Every column in WHERE exists in schema (exact match)\n   ✓ Every column in ORDER BY exists in schema (exact match)\n   ✓ Every column in GROUP BY exists in schema (exact match)\n   ✓ Every table name in FROM/JOIN exists in AVAILABLE TABLES (exact match)\n   ✓ Every JOIN condition references valid columns in both tables\n   ✓ All table aliases are defined and used consistently\n   ✓ Query is syntactically valid MySQL\n   \n   If ANY check fails → RETURN ERROR with specific details\n\n6. EXPLANATION REQUIREMENTS:\n   - State clearly what was modified\n   - Show before/after for the changed parts\n   - List exact column names used from schema\n   - Example: \"Added column d.department_name (verified in schema). Added LEFT JOIN departments d ON e.dept_id = d.id. Preserved original WHERE clause and LIMIT.\"\n   - If request is ambiguous, make a reasonable assumption and explain it clearly\n\n7. SPECIAL CASES:\n\n   A. EMPLOYEE NAME FILTERING (if adding name filters):\n      - FIRST: Check schema for name columns (could be: first_name, last_name, full_name, employee_name, name, etc.)\n      - Use EXACT column names found in schema\n      - Example with schema having first_name and last_name:\n        WHERE e.first_name = 'John' \n           OR e.last_name = 'John'\n           OR CONCAT_WS(' ', e.first_name, e.last_name) = 'John'\n\n   B. DATE FILTERS (if modifying date conditions):\n      - FIRST: Verify date column exists (could be: created_at, date, hire_date, etc.)\n      - Use proper MySQL date functions\n      - Example: \"this year\" means WHERE YEAR(date_col) = YEAR(CURDATE())\n\n   C. AGGREGATIONS (if adding GROUP BY):\n      - FIRST: Verify all columns exist in schema\n      - Ensure all non-aggregated columns in SELECT are in GROUP BY\n      - Use appropriate aggregate functions: SUM(), COUNT(), AVG(), MIN(), MAX()\n\nOUTPUT FORMAT (JSON ONLY):\n{\n  \"sql_query\": \"SELECT ... (complete modified query with ALL clauses)\",\n  \"explanation\": \"Modified: [list each specific change]. Added [X], Changed [Y] from [old] to [new]. Preserved [Z]. Verified all column names exist in schema: [list columns]. Made this change because [reason based on user request].\",\n  \"tables_used\": [\"table1\", \"table2\"],\n  \"modifications_made\": [\"Added column d.department_name\", \"Added LEFT JOIN departments d ON e.dept_id = d.id\"],\n  \"columns_verified\": [\"column1\", \"column2\", \"column3\"],\n  \"confidence\": \"high\"\n}\n\nEXAMPLE 1 - ADD COLUMN WITH VALIDATION:\n\nOriginal SQL:\nSELECT e.id, e.first_name, e.last_name, e.salary\nFROM employees e\nWHERE e.salary > 50000\nLIMIT 100;\n\nSchema shows employees table has: id, first_name, last_name, salary, dept_id\nSchema shows dept table has: id, dept_name, location\n\nUser Request: \"also show their department names\"\n\nVALIDATION PROCESS:\n1. User wants \"department names\"\n2. Search schema for \"department_name\" → NOT FOUND\n3. Search for alternatives: \"dept_name\" → FOUND in dept table\n4. Need to join dept table to access dept_name\n5. Check join key: employees.dept_id = dept.id → VALID\n\nCorrect Output:\n{\n  \"sql_query\": \"SELECT e.id, e.first_name, e.last_name, e.salary, d.dept_name\\nFROM employees e\\nLEFT JOIN dept d ON e.dept_id = d.id\\nWHERE e.salary > 50000\\nLIMIT 100;\",\n  \"explanation\": \"Modified: Added column d.dept_name (verified in schema as 'dept_name', not 'department_name'). Added LEFT JOIN dept d ON e.dept_id = d.id to fetch department data. Preserved original WHERE clause (salary > 50000) and LIMIT 100.\",\n  \"tables_used\": [\"employees\", \"dept\"],\n  \"modifications_made\": [\"Added column d.dept_name\", \"Added LEFT JOIN dept d ON e.dept_id = d.id\"],\n  \"columns_verified\": [\"id\", \"first_name\", \"last_name\", \"salary\", \"dept_id\", \"dept_name\"],\n  \"confidence\": \"high\"\n}\n\nEXAMPLE 2 - ERROR WHEN COLUMN DOESN'T EXIST:\n\nOriginal SQL:\nSELECT e.id, e.first_name, e.last_name\nFROM employees e\nLIMIT 100;\n\nSchema shows employees table has: id, first_name, last_name, salary\n(NO email-related columns exist)\n\nUser Request: \"also show their email addresses\"\n\nVALIDATION PROCESS:\n1. User wants \"email addresses\"\n2. Search schema for \"email\" → NOT FOUND\n3. Search for \"email_address\" → NOT FOUND\n4. Search for \"mail\" → NOT FOUND\n5. NO email columns exist in any table\n\nERROR Output:\n{\n  \"sql_query\": \"ERROR\",\n  \"message\": \"Cannot modify query: Column 'email' or 'email_address' does not exist in the employees table or any related tables in the schema. Available columns in employees are: id, first_name, last_name, salary. Did you mean to add a different column?\",\n  \"original_sql\": \"SELECT e.id, e.first_name, e.last_name\\nFROM employees e\\nLIMIT 100;\",\n  \"available_columns\": [\"id\", \"first_name\", \"last_name\", \"salary\"],\n  \"user_requested\": \"email addresses\"\n}\n\nEXAMPLE 3 - ERROR WHEN TABLE DOESN'T EXIST:\n\nOriginal SQL:\nSELECT e.id, e.first_name\nFROM employees e\nLIMIT 100;\n\nAVAILABLE TABLES: employees, dept, salary_history\n(NO \"departments\" table exists)\n\nUser Request: \"join with departments table\"\n\nVALIDATION PROCESS:\n1. User wants to join \"departments\"\n2. Check AVAILABLE TABLES → \"departments\" NOT FOUND\n3. Check for similar: \"dept\" FOUND\n\nERROR Output:\n{\n  \"sql_query\": \"ERROR\",\n  \"message\": \"Cannot modify query: Table 'departments' does not exist in the database. Available tables are: employees, dept, salary_history. Did you mean to join with 'dept' table instead?\",\n  \"original_sql\": \"SELECT e.id, e.first_name\\nFROM employees e\\nLIMIT 100;\",\n  \"available_tables\": [\"employees\", \"dept\", \"salary_history\"],\n  \"user_requested\": \"departments\"\n}\n\nERROR HANDLING:\nIf the modification is impossible or unclear, return:\n{\n  \"sql_query\": \"ERROR\",\n  \"message\": \"Cannot modify query: [specific reason]. [Explain what's wrong: missing table, invalid column, unclear request, etc.]. Did you mean [reasonable suggestion with EXACT schema names]?\",\n  \"original_sql\": \"{{ $json.lastSQL }}\",\n  \"available_columns\": [\"list of actual column names from schema\"],\n  \"available_tables\": [\"list from AVAILABLE TABLES\"],\n  \"user_requested\": \"what user asked for\"\n}\n\nCOMMON ERROR TEMPLATES:\n- \"Cannot modify query: Column '[user_input]' does not exist. Available columns in [table]: [exact_list]. Did you mean '[closest_match]'?\"\n- \"Cannot modify query: Table '[user_input]' does not exist. Available tables: [exact_list]. Did you mean '[closest_match]'?\"\n- \"Cannot modify query: Cannot join [table1] and [table2] - no foreign key relationship found in schema.\"\n- \"Cannot modify query: Your request is ambiguous. Did you mean add column '[exact_name]' or filter by '[exact_name]'?\"\n\nREMEMBER: \n- Your job is to MODIFY, not to REWRITE\n- NEVER invent column or table names\n- ALWAYS verify against schema BEFORE generating SQL\n- If in doubt, RETURN ERROR with suggestions\n- Use EXACT names from schema, not logical/common names"
        }
      },
      "type": "@n8n/n8n-nodes-langchain.agent",
      "typeVersion": 3,
      "position": [
        -256,
        -464
      ],
      "id": "bb14de44-aed5-42ce-aab7-567cc4d8bd1a",
      "name": "AI Agent"
    },
    {
      "parameters": {
        "model": {
          "__rl": true,
          "value": "gpt-4o-mini-2024-07-18",
          "mode": "list",
          "cachedResultName": "gpt-4o-mini-2024-07-18"
        },
        "builtInTools": {},
        "options": {}
      },
      "type": "@n8n/n8n-nodes-langchain.lmChatOpenAi",
      "typeVersion": 1.3,
      "position": [
        -256,
        -272
      ],
      "id": "9b5d526a-bff6-4ef7-9bed-4ec76dfd23cd",
      "name": "OpenAI Chat Model",
      "credentials": {
        "openAiApi": {
          "id": "rWng8HjwFzEyGRf0",
          "name": "text2sql"
        }
      }
    }
  ],
  "connections": {
    "LLM Table Selector1": {
      "ai_languageModel": [
        [
          {
            "node": "Select Relevant Tables1",
            "type": "ai_languageModel",
            "index": 0
          }
        ]
      ]
    },
    "Select Relevant Tables1": {
      "main": [
        [
          {
            "node": "Validate Table Selection1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Validate Table Selection1": {
      "main": [
        [
          {
            "node": "Read Filtered Schema1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Read Filtered Schema1": {
      "main": [
        [
          {
            "node": "Build Filtered Schema JSON1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Build Filtered Schema JSON1": {
      "main": [
        [
          {
            "node": "If1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Generate SQL (LLM)1": {
      "ai_languageModel": [
        [
          {
            "node": "Universal SQL Agent1",
            "type": "ai_languageModel",
            "index": 0
          }
        ]
      ]
    },
    "Universal SQL Agent1": {
      "main": [
        [
          {
            "node": "Validate SQL Safety1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Validate SQL Safety1": {
      "main": [
        [
          {
            "node": "Execute Generated SQL1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Execute Generated SQL1": {
      "main": [
        [
          {
            "node": "Code in JavaScript",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "If": {
      "main": [
        [
          {
            "node": "Code in JavaScript1",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Code in JavaScript1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Code in JavaScript": {
      "main": [
        [
          {
            "node": "If",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Webhook": {
      "main": [
        [
          {
            "node": "Code in JavaScript2",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Read Table List Only": {
      "main": [
        [
          {
            "node": "Format Table List",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Format Table List": {
      "main": [
        [
          {
            "node": "Select Relevant Tables1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Code in JavaScript1": {
      "main": [
        [
          {
            "node": "Respond to Webhook",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Code in JavaScript2": {
      "main": [
        [
          {
            "node": "Read Table List Only",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "If1": {
      "main": [
        [
          {
            "node": "AI Agent",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Universal SQL Agent1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "AI Agent": {
      "main": [
        [
          {
            "node": "Validate SQL Safety1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OpenAI Chat Model": {
      "ai_languageModel": [
        [
          {
            "node": "AI Agent",
            "type": "ai_languageModel",
            "index": 0
          }
        ]
      ]
    }
  },
  "pinData": {},
  "meta": {
    "instanceId": "b4014ee051fd78e43ccc9e0ba058ceb98ba0002058297943e9f1838316385f97"
  }
}