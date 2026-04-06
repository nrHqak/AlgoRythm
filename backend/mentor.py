import os
from typing import Any

import google.generativeai as genai

SYSTEM_PROMPT = (
    "You are an AI mentor for students learning algorithms. "
    "NEVER write corrected or fixed code. "
    "NEVER directly state what needs to be changed. "
    "Use only Socratic questions and metaphors. "
    "Maximum 2-3 sentences. Reply in the same language the user writes in."
)


def generate_mentor_hint(
    code: str,
    error: str,
    error_line: int,
    trace_context: str,
    user_question: str,
) -> dict[str, Any]:
    api_key = os.environ.get("GEMINI_API_KEY")
    fallback = {
        "message": f"Look at line {error_line}. What is the value of the index at this point?",
        "hint_type": "fallback",
    }

    if not api_key:
        return fallback

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            "gemini-1.5-flash",
            system_instruction=SYSTEM_PROMPT,
        )
        prompt = "\n\n".join(
            [
                f"Code:\n{code}",
                f"Error: {error}",
                f"Error line: {error_line}",
                f"Trace context: {trace_context}",
                f"Student question: {user_question}",
            ]
        )
        response = model.generate_content(prompt)
        message = (getattr(response, "text", "") or "").strip()
        if not message:
            return fallback
        return {"message": message, "hint_type": "socratic"}
    except Exception:
        return fallback
