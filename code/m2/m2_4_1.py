import instructor
from typing import Literal

from pydantic import BaseModel, Field

from common import client

# response_model 是 instructor 扩展的参数，必须用包装后的 client
instructor_client = instructor.from_openai(client)


class CodeAnalysis(BaseModel):
    complexity: str = Field(description="时间复杂度", enum=["O(1)", "O(n)", "O(n²)", "O(2ⁿ)"])
    issues: list[str] = Field(description="发现的问题")
    suggestions: list[str] = Field(description="改进建议")


analysis = instructor_client.chat.completions.create(
    model="deepseek-v4-pro",
    response_model=CodeAnalysis,
    extra_body={"thinking": {"type": "disabled"}},
    messages=[{"role": "user", "content": "分析这段代码：def fib(n): return n if n<2 else fib(n-1)+fib(n-2)"}],
)

print(analysis.complexity)  # "O(2ⁿ)"
print(analysis.issues)  # ["使用递归导致指数级时间复杂度", "没有缓存中间结果"]
