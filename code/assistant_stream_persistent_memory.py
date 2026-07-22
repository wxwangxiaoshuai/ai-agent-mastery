import os

from common import client
from file_history import clear_history, load_history, save_history

ROLES = {
    "default": "你是一个友好的 AI 助手。",
    "coder": "你是一位资深 Python 工程师，擅长代码审查和性能优化。回答简洁直接。",
    "translator": "你是一位专业的中英翻译，所有回复都用英文。",
    "teacher": "你是一位耐心的编程老师，用通俗语言解释概念，配合代码示例。",
}

current_role = "default"
messages = load_history()

while True:
    user_input = input("你：").strip()

    if user_input.lower() in ("quit", "exit"):
        print("再见！")
        break
    if not user_input:
        continue

    if user_input == "/clear":
        messages = []
        clear_history()
        print("对话历史已清空。")
        continue

    if user_input.startswith("/role "):
        role_name = user_input[6:].strip()
        if role_name in ROLES:
            current_role = role_name
            messages = []
            clear_history()
            print(f"已切换到角色: {role_name}（历史已清空）")
        else:
            print(f"未知角色: {role_name}，可选: {', '.join(ROLES.keys())}")
        continue

    messages.append({"role": "user", "content": user_input})
    full_messages = [{"role": "system", "content": ROLES[current_role]}] + messages

    response = client.chat.completions.create(
        model=os.getenv("MODEL_NAME"),
        messages=full_messages,
        stream=True,
    )
    print("助手：", end="", flush=True)
    full_reply = ""
    for chunk in response:
        if chunk and chunk.choices and chunk.choices[0].delta.content:
            full_reply += chunk.choices[0].delta.content
            print(chunk.choices[0].delta.content, end="", flush=True)
    print()

    messages.append({"role": "assistant", "content": full_reply})
    save_history(messages)
