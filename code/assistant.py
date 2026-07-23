import os

from dotenv import load_dotenv
from openai import APIError, APITimeoutError, RateLimitError

from common import client
from file_history import clear_history, load_history, save_history

load_dotenv()

ROLES = {
    "default": "你是一个友好的 AI 助手。",
    "coder": "你是一位资深 Python 工程师，擅长代码审查和性能优化。回答简洁直接。",
    "translator": "你是一位专业的中英翻译，所有回复都用英文。",
    "teacher": "你是一位耐心的编程老师，用通俗语言解释概念，配合代码示例。",
}


def chat():
    current_role = "default"
    messages = load_history()

    print("=" * 50)
    print("CLI AI 助手已启动（输入 quit 退出）")
    print("命令: /role <name> | /clear | /history | quit")
    if messages:
        print(f"已加载 {len(messages)} 条历史消息")
    print("=" * 50)

    while True:
        try:
            user_input = input("\n你: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n再见！")
            break

        if not user_input:
            continue

        if user_input.lower() in ("quit", "exit"):
            print("再见！")
            break

        if user_input == "/clear":
            messages = []
            clear_history()
            print("对话历史已清空。")
            continue

        if user_input == "/history":
            if not messages:
                print("  （暂无历史）")
            for m in messages:
                print(f"  [{m['role']}] {m['content'][:80]}")
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

        try:
            stream = client.chat.completions.create(
            model=os.getenv("MODEL_NAME", "gpt-4o-mini"),
                messages=full_messages,
                stream=True,
            )
            print("AI: ", end="", flush=True)
            reply = ""
            for chunk in stream:
                if not chunk or not chunk.choices or not chunk.choices[0].delta.content:
                    continue
                text = chunk.choices[0].delta.content
                print(text, end="", flush=True)
                reply += text
            print()

            messages.append({"role": "assistant", "content": reply})
            save_history(messages)

        except APITimeoutError:
            print("\n[超时] 请重试。")
            messages.pop()
        except RateLimitError:
            print("\n[限流] 请稍后再试。")
            messages.pop()
        except APIError as e:
            print(f"\n[错误] {e}")
            messages.pop()


if __name__ == "__main__":
    chat()
