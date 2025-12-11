DEBUG = True

import streamlit as st
from datetime import datetime
import requests
import json

# ----------------- PAGE CONFIG -----------------
st.set_page_config(
    page_title="Text2SQL",
    page_icon="💬",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ----------------- CUSTOM CSS -----------------
st.markdown(
    """
    <style>
    .stApp {
        background: linear-gradient(180deg, #b295c9 0%, #455799 50%, #1a1f3a 100%);
        min-height: 100vh;
    }

    [data-testid="stSidebar"] {
        background: linear-gradient(180deg, #1a1f3a 0%, #2d3458 100%);
    }

    [data-testid="stSidebar"] * {
        color: #ffffff !important;
    }

    .chat-message {
        padding: 1.5rem;
        border-radius: 1rem;
        margin-bottom: 1rem;
        display: flex;
        flex-direction: column;
        backdrop-filter: blur(10px);
    }
    .user-message {
        background: linear-gradient(135deg, rgba(178, 149, 201, 0.95), rgba(178, 149, 201, 0.85));
        border-left: 4px solid #b295c9;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
    }
    .assistant-message {
        background: linear-gradient(135deg, rgba(69, 87, 153, 0.95), rgba(69, 87, 153, 0.85));
        border-left: 4px solid #455799;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
    }
    .message-header {
        font-weight: 600;
        margin-bottom: 0.5rem;
        color: #ffffff;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    }
    .message-content {
        color: #ffffff;
        line-height: 1.6;
    }
    .timestamp {
        font-size: 0.75rem;
        color: #e0e0e0;
        margin-top: 0.5rem;
    }
    .stTextArea textarea {
        background: rgba(26, 31, 58, 0.7) !important;
        border: 2px solid #455799 !important;
        border-radius: 0.5rem;
        color: #ffffff !important;
        font-weight: 500;
    }
    .stTextArea textarea::placeholder {
        color: #b295c9 !important;
    }
    h1 {
        color: #ffffff !important;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    }
    h2, h3 {
        color: #ffffff !important;
    }
    .result-table-container {
        background: rgba(26, 31, 58, 0.85);
        padding: 1.5rem;
        border-radius: 1rem;
        margin-bottom: 1.5rem;
        margin-top: 0.5rem;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        border: 1px solid #455799;
    }
    .result-table-container h2 {
        color: #b295c9 !important;
    }
    .sidebar-title {
        color: #b295c9 !important;
        font-size: 1.8rem !important;
        font-weight: 700 !important;
        margin-bottom: 1.5rem !important;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
    }
    .sidebar-section-title {
        color: #ffffff !important;
        font-size: 1.1rem !important;
        font-weight: 600 !important;
        margin-top: 0.5rem !important;
        margin-bottom: 0.75rem !important;
    }

    .stButton button {
        background: linear-gradient(135deg, #455799, #b295c9);
        color: #ffffff !important;
        border: none;
        border-radius: 0.5rem;
        font-weight: 600;
        transition: all 0.3s;
    }
    .stButton button:hover {
        background: linear-gradient(135deg, #b295c9, #455799);
        box-shadow: 0 4px 12px rgba(178, 149, 201, 0.4);
    }

    hr {
        border-color: rgba(69, 87, 153, 0.5) !important;
    }

    [data-testid="stDataFrame"] {
        background: rgba(26, 31, 58, 0.5);
    }

    .stInfo {
        background: rgba(69, 87, 153, 0.3);
        color: #ffffff;
    }

    .main .block-container {
        padding-bottom: 120px;
    }

    .stInfo p {
        color: #ffffff !important;
        font-size: 1.1rem;
    }

    .empty-result-box {
        background: rgba(178, 149, 201, 0.2);
        border: 2px dashed #b295c9;
        border-radius: 1rem;
        padding: 2rem;
        text-align: center;
        margin: 1rem 0;
    }

    .empty-result-box h3 {
        color: #b295c9 !important;
        margin-bottom: 1rem;
    }

    .no-table-box {
        background: rgba(255, 152, 0, 0.2);
        border: 2px dashed #ff9800;
        border-radius: 1rem;
        padding: 2rem;
        text-align: center;
        margin: 1rem 0;
    }

    .no-table-box h3 {
        color: #ffb74d !important;
        margin-bottom: 1rem;
    }

    .modification-box {
        background: rgba(69, 87, 153, 0.3);
        border: 1px solid #455799;
        border-radius: 0.8rem;
        padding: 1rem;
        margin: 1rem 0;
    }

    .modification-badge {
        display: inline-block;
        background: rgba(178, 149, 201, 0.4);
        padding: 0.3rem 0.8rem;
        border-radius: 0.5rem;
        font-size: 0.85rem;
        margin-bottom: 0.5rem;
    }
    </style>
    """,
    unsafe_allow_html=True
)

# ----------------- SESSION STATE INIT -----------------
if "messages" not in st.session_state:
    st.session_state.messages = []

if "history" not in st.session_state:
    st.session_state.history = []

if "n8n_webhook_url" not in st.session_state:
    st.session_state.n8n_webhook_url = "https://botmaticai.app.n8n.cloud/webhook/6700ffbc-052a-44f8-99f3-ece432c4b975"

if "current_history_index" not in st.session_state:
    st.session_state.current_history_index = None

if "awaiting_modification" not in st.session_state:
    st.session_state.awaiting_modification = None

if "awaiting_elaboration" not in st.session_state:
    st.session_state.awaiting_elaboration = None


# ----------------- HELPER: CALL n8n -----------------
def call_n8n(webhook_url: str, payload: dict) -> tuple:
    """Send payload to n8n webhook; return (assistant_response, rows, sql_query, no_table_found)."""
    if DEBUG:
        st.write("🔍 [DEBUG] Calling n8n webhook...")
        st.json({
            "webhook_url": webhook_url,
            "payload": payload
        })

    try:
        response = requests.post(
            webhook_url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
    except requests.exceptions.Timeout:
        if DEBUG:
            st.write(" [DEBUG] Timeout while calling n8n")
        return ("⏱ Request timed out. Your n8n workflow is slow or unreachable.", [], None, False)
    except requests.exceptions.RequestException as e:
        if DEBUG:
            st.write(" [DEBUG] RequestException:", str(e))
        return (" Connection error: " + str(e) + "\n\nCheck webhook URL, workflow status, and network.", [], None,
                False)

    if DEBUG:
        st.write(" [DEBUG] n8n responded with status:", response.status_code)
        st.text("🔍 [DEBUG] Raw response text:\n" + response.text[:500])

    if response.status_code != 200:
        return (" n8n Error (" + str(response.status_code) + "):\n\n" + response.text, [], None, False)

    try:
        data = response.json()
    except ValueError:
        return (" n8n returned non-JSON:\n\n" + response.text, [], None, False)

    rows = []
    sql_query = None
    no_table_found = False

    # ---------- Check for no table found condition ----------
    if isinstance(data, dict):
        # Check various possible indicators that no table was found
        if (data.get("no_table_found") or
                data.get("noTableFound") or
                data.get("status") == "no_table" or
                (isinstance(data.get("data"), dict) and data["data"].get("no_table_found"))):
            no_table_found = True

            # Extract message from backend
            message = (data.get("message") or
                       data.get("error") or
                       (isinstance(data.get("data"), dict) and data["data"].get("message")) or
                       "I couldn't identify the relevant table(s) for your query.")

            return (message, [], None, True)

        # Check for explicit rowCount = 0 in wrapped format
        if isinstance(data.get("data"), dict):
            row_count = data["data"].get("rowCount")
            if row_count is not None and row_count == 0:
                rows = []  # Empty results

    # ---------- Wrapped format: { status, message, data: { ... } } ----------
    if isinstance(data, dict) and isinstance(data.get("data"), dict):
        inner = data["data"]
        sql_query = inner.get("sqlQuery") or inner.get("sql_query") or inner.get("sql")
        explanation = inner.get("explanation") or data.get("message") or ""
        row_count = inner.get("rowCount")
        tables_used = inner.get("tablesUsed") or inner.get("tables_used")
        rows = inner.get("rows") or []
        is_modification = inner.get("isModification", False)
        changes_made = inner.get("changesMade", [])

        output_parts = []

        if sql_query:
            output_parts.append("**Generated SQL:**\n```sql\n" + sql_query + "\n```\n")

        if explanation:
            output_parts.append("**Explanation:**\n" + explanation + "\n")

        if row_count is not None:
            output_parts.append(f"**Rows:** {row_count}")

        if tables_used:
            output_parts.append(f"**Tables Used:** `{', '.join(tables_used)}`")

        # Only show this message if there are actually rows
        if rows and len(rows) > 0:
            output_parts.append("_Result table shown below._")

        if output_parts:
            # Ensure rows is properly set (empty list if no rows)
            final_rows = rows if isinstance(rows, list) and len(rows) > 0 else []
            return ("\n".join(output_parts), final_rows, sql_query, False)

        return (json.dumps(data, indent=2), [], sql_query, False)

    # ---------- Direct format: { sql_query, explanation, ... } ----------
    if isinstance(data, dict) and ("sql_query" in data or "sql" in data):
        sql_query = data.get("sql_query") or data.get("sql")
        explanation = data.get("explanation") or data.get("message") or ""

        output = ""
        if sql_query:
            output += "**Generated SQL:**\n```sql\n" + sql_query + "\n```\n\n"
        if explanation:
            output += "**Explanation:**\n" + explanation

        return (output if output else json.dumps(data, indent=2), [], sql_query, False)

    # ---------- Generic fallback ----------
    if isinstance(data, dict):
        result = (
                data.get("response")
                or data.get("message")
                or data.get("output")
                or data.get("result")
                or json.dumps(data, indent=2)
        )
        return (result, [], sql_query, False)

    if isinstance(data, list) and len(data) > 0:
        return (json.dumps(data[0], indent=2), [], sql_query, False)

    return (str(data), [], sql_query, False)


# ----------------- SIDEBAR -----------------
with st.sidebar:
    st.markdown("<h1 class='sidebar-title'>💬 Text2SQL</h1>", unsafe_allow_html=True)

    if st.button("➕ New Chat", use_container_width=True):
        if st.session_state.messages and st.session_state.current_history_index is None:
            st.session_state.history.append({
                "timestamp": datetime.now(),
                "messages": st.session_state.messages.copy()
            })

        st.session_state.messages = []
        st.session_state.current_history_index = None
        st.session_state.awaiting_modification = None
        st.session_state.awaiting_elaboration = None
        st.rerun()

    st.divider()

    st.markdown("<h3 class='sidebar-section-title'>📜 Chat History</h3>", unsafe_allow_html=True)

    if st.session_state.history:
        st.markdown("**Previous Conversations:**")
        for idx, hist in enumerate(reversed(st.session_state.history)):
            actual_idx = len(st.session_state.history) - 1 - idx
            timestamp_str = hist["timestamp"].strftime("%b %d, %I:%M %p")
            first_msg = next((m["content"][:50] + "..." if len(m["content"]) > 50 else m["content"]
                              for m in hist["messages"] if m["role"] == "user"), "Chat")

            if st.button(
                    f" {timestamp_str}\n{first_msg}",
                    key=f"hist_{idx}",
                    use_container_width=True
            ):
                st.session_state.messages = hist["messages"].copy()
                st.session_state.current_history_index = actual_idx
                st.session_state.awaiting_modification = None
                st.session_state.awaiting_elaboration = None
                st.rerun()
    else:
        st.info("No previous conversations yet.")

    st.divider()

    if st.session_state.history:
        if st.button("🗑️ Clear History", use_container_width=True):
            st.session_state.history = []
            st.rerun()

# ----------------- MAIN CHAT UI -----------------
st.title("SQL Query Optimizer")
st.divider()

chat_container = st.container()

with chat_container:
    if st.session_state.messages:
        for i, msg in enumerate(st.session_state.messages):
            css = "user-message" if msg["role"] == "user" else "assistant-message"
            header = "👤 You" if msg["role"] == "user" else "🤖 Assistant"

            # Show modification badge if this was a query modification
            badge_html = ""
            if msg.get("is_modification"):
                badge_html = "<div class='modification-badge'> Query Modified</div>"
            elif msg.get("is_elaboration"):
                badge_html = "<div class='modification-badge'> Elaborated Query</div>"

            st.markdown(
                badge_html +
                "<div class='chat-message " + css + "'>"
                                                    "<div class='message-header'>" + header + "</div>"
                                                                                              "<div class='message-content'>" +
                msg["content"] + "</div>"
                                 "<div class='timestamp'>" + msg["timestamp"] + "</div>"
                                                                                "</div>",
                unsafe_allow_html=True
            )

            # Handle assistant messages
            if msg["role"] == "assistant":
                # No table found handler
                if msg.get("no_table_found"):
                    st.markdown("<div class='no-table-box'>", unsafe_allow_html=True)
                    st.markdown("### 🔍 Unable to Identify Table")
                    st.markdown("I couldn't find the right table(s) for your query. Could you provide more details?")
                    st.markdown("**Try adding:**")
                    st.markdown("- Specific column names you're looking for")
                    st.markdown("- The entity or subject (e.g., employees, orders, customers)")
                    st.markdown("- Time period or date range")
                    st.markdown("- Any relevant filters or conditions")
                    st.markdown("</div>", unsafe_allow_html=True)

                    if st.button(f"💬 Provide More Details", key=f"no_table_elaborate_{i}"):
                        st.session_state.awaiting_elaboration = i
                        st.rerun()

                # Empty result handler
                elif msg.get("empty_result") and msg.get("sql_query"):
                    st.markdown("<div class='empty-result-box'>", unsafe_allow_html=True)
                    st.markdown("### 🔍 No Results Found")
                    st.markdown("The query returned no data. Could you elaborate on what you're looking for?")
                    st.markdown("</div>", unsafe_allow_html=True)

                    if st.button(f"💬 Provide More Details", key=f"elaborate_btn_{i}"):
                        st.session_state.awaty results
                elif msg.get("sql_query") and msg.get("rows"):
                    if st.button(f"✏️ Modify This Query", key=f"modify_btn_{i}"):
                        st.session_state.awaiting_modification = i
                        st.rerun()

                # Show results table
                if "rows" in msg and msg["rows"] and len(msg["rows"]) > 0:
                    st.markdown("<div class='result-table-container'>"iting_elaboration = i
                        st.rerun()

                # Show modify query button for non-empty results
                elif msg.get("sql_query") and msg.get("rows"):
                    if st.button(f"✏️ Modify This Query", key=f"modify_btn_{i}"):
                        st.session_state.awaiting_modification = i
                        st.rerun()

                # Show results table
                if "rows" in msg and msg["rows"] and len(msg["rows"]) > 0:
                    st.markdown("<div class='result-table-container'>", unsafe_allow_html=True)
                    st.subheader("📊 Query Results")
                    st.dataframe(msg["rows"], use_container_width=True)
                    st.markdown("</div>", unsafe_allow_html=True)
    else:
        st.info("👋 Welcome! Ask me anything about your database.")

# ----------------- INPUT -----------------
st.divider()

# Determine input placeholder and context
input_placeholder = "Ask a question about your data..."
input_mode = "normal"

if st.session_state.awaiting_modification is not None:
    input_placeholder = "Tell me how to modify the query (e.g., 'remove email column', 'change to last 30 days', 'add department name')..."
    input_mode = "modification"
    msg_idx = st.session_state.awaiting_modification
    original_msg = st.session_state.messages[msg_idx]

    st.info(f"💡 **Modification Mode**: Tell me how you want to change the query. Examples:\n"
            f"- 'Remove the email column'\n"
            f"- 'Show only last 30 days'\n"
            f"- 'Add employee department'\n"
            f"- 'Order by salary descending'")

elif st.session_state.awaiting_elaboration is not None:
    msg_idx = st.session_state.awaiting_elaboration
    original_msg = st.session_state.messages[msg_idx]

    # Check if it's a no-table scenario
    if original_msg.get("no_table_found"):
        input_placeholder = "Provide more details (e.g., 'I need employee data', 'from the sales table', 'include order information')..."
        st.info(f"💡 **Table Clarification Mode**: Help me understand which table(s) you need. Examples:\n"
                f"- 'I'm looking for employee information'\n"
                f"- 'I need data from the orders table'\n"
                f"- 'Show me customer records'\n"
                f"- 'I want sales data for last month'")
    else:
        input_placeholder = "Provide more details (e.g., 'I meant employees in Sales', 'from last month', 'include inactive records')..."
        st.info(f"💡 **Elaboration Mode**: Provide more context about what you're looking for.")

    input_mode = "elaboration"

with st.form(key="chat_form", clear_on_submit=True):
    col1, col2 = st.columns([6, 1])

    with col1:
        user_input = st.text_area(
            "Your message:",
            height=100,
            placeholder=input_placeholder,
            key=f"input_{input_mode}"
        )

    with col2:
        send = st.form_submit_button("📤 Send", use_container_width=True)

# ----------------- PROCESS REQUEST -----------------
if send and user_input.strip():
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Determine payload based on mode
    if input_mode == "modification":
        # Query modification mode
        msg_idx = st.session_state.awaiting_modification
        original_msg = st.session_state.messages[msg_idx]

        st.session_state.messages.append({
            "role": "user",
            "content": f"🔄 Modify: {user_input}",
            "timestamp": timestamp,
            "is_modification": True
        })

        payload = {
            "query": user_input,
            "request_type": "modification",  # NEW: Indicates modification request
            "timestamp": timestamp,
            "conversation_history": [
                {
                    "role": msg["role"],
                    "content": msg["content"],
                    "sql_query": msg.get("sql_query"),
                    "rows": msg.get("rows", [])
                }
                for msg in st.session_state.messages
            ]
        }

        st.session_state.awaiting_modification = None

    elif input_mode == "elaboration":
        # Elaboration mode for empty results or no table found
        msg_idx = st.session_state.awaiting_elaboration
        original_msg = st.session_state.messages[msg_idx]

        st.session_state.messages.append({
            "role": "user",
            "content": f"💬 Elaboration: {user_input}",
            "timestamp": timestamp,
            "is_elaboration": True
        })

        # NEW: Send elaboration with context to backend
        payload = {
            "query": user_input,
            "request_type": "elaboration",  # NEW: Indicates elaboration request
            "timestamp": timestamp,
            "elaboration_context": {  # NEW: Context about what needs elaboration
                "original_query": original_msg.get("original_query", ""),
                "was_no_table": original_msg.get("no_table_found", False),
                "was_empty_result": original_msg.get("empty_result", False),
                "previous_sql": original_msg.get("sql_query")
            },
            "conversation_history": [
                {
                    "role": msg["role"],
                    "content": msg["content"],
                    "sql_query": msg.get("sql_query"),
                    "rows": msg.get("rows", []),
                    "no_table_found": msg.get("no_table_found", False),
                    "empty_result": msg.get("empty_result", False)
                }
                for msg in st.session_state.messages
            ]
        }

        st.session_state.awaiting_elaboration = None

    else:
        # Normal query mode
        st.session_state.messages.append({
            "role": "user",
            "content": user_input,
            "timestamp": timestamp
        })

        payload = {
            "query": user_input,
            "request_type": "normal",  # NEW: Indicates normal request
            "timestamp": timestamp,
            "conversation_history": [
                {
                    "role": msg["role"],
                    "content": msg["content"],
                    "sql_query": msg.get("sql_query"),
                    "rows": msg.get("rows", [])
                }
                for msg in st.session_state.messages
            ]
        }

    # Call n8n
    if st.session_state.n8n_webhook_url:
        with st.spinner("Processing..."):
            assistant_response, rows, sql_query, no_table_found = call_n8n(
                st.session_state.n8n_webhook_url,
                payload
            )
    else:
        assistant_response = (
            "⚠️ Backend Not Configured\n\n"
            "Please configure the webhook URL to process queries."
        )
        rows = []
        sql_query = None
        no_table_found = False

    st.session_state.messages.append({
        "role": "assistant",
        "content": assistant_response,
        "timestamp": timestamp,
        "rows": rows,
        "sql_query": sql_query,
        "empty_result": (len(rows) == 0 and sql_query is not None and not no_table_found),
        # FIXED: Check for SQL query existence
        "no_table_found": no_table_found,
        "original_query": user_input if input_mode == "normal" else payload.get("query", user_input),
        "is_modification": input_mode == "modification",
        "is_elaboration": input_mode == "elaboration"
    })

    if st.session_state.current_history_index is not None:
        st.session_state.history[st.session_state.current_history_index] = {
            "timestamp": st.session_state.history[st.session_state.current_history_index]["timestamp"],
            "messages": st.session_state.messages.copy()
        }

    st.rerun()

# Footer
st.markdown("---")
st.markdown("Myvyaydev DB", unsafe_allow_html=True)
