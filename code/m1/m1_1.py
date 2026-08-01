from common import client

resp = client.chat.completions.create(
    model="deepseek-v4-pro",
    messages=[{"role": "user", "content": "ISO 8601 里表示周数的字母是什么？"}],
    logprobs=True, # 看看它在纠结哪几个候选
    top_logprobs=6,
    max_tokens=20,
    extra_body={"thinking": {"type": "disabled"}}
)
for t in resp.choices[0].logprobs.content:
    print(t.token,round(t.logprob,3))