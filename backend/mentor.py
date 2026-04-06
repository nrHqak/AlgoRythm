import os
import logging
from typing import Any

import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

DEFAULT_MODEL = os.environ.get("GEMINI_MODEL", "gemini-flash-latest")

SYSTEM_PROMPT = """You are AlgoRythm's AI mentor for students learning algorithms.
RULES:
1. NEVER write corrected or fixed code.
2. NEVER directly state what is wrong.
3. Use Socratic questions and metaphors.
4. For conceptual questions (not debugging): give clear, concise explanations.
5. Maximum 3 sentences per response.
6. Reply in the same language the user writes in.
7. If mode is 'proactive', be brief and gentle — one question only."""

FALLBACK_MESSAGES = {
    "reactive": "Take a close look at line {error_line}. What is the value of the index right before this line runs?",
    "proactive": "What do you notice about the highlighted bars at this step?",
    "free_chat": "That's a great question. Try tracing through the code manually — what happens on each iteration?",
}


def build_fallback(mode: str, error_line: int | None) -> dict[str, Any]:
    template = FALLBACK_MESSAGES.get(mode, FALLBACK_MESSAGES["free_chat"])
    return {
        "message": template.format(error_line=error_line or "?"),
        "hint_type": "fallback",
    }


def is_conceptual_question(user_question: str | None, mode: str, error: str | None) -> bool:
    if mode != "free_chat":
        return False
    if error:
        return False
    prompt = (user_question or "").lower()
    conceptual_markers = [
        "what is",
        "why",
        "difference",
        "complexity",
        "big o",
        "o(",
        "interview",
        "concept",
        "explain",
        "when should",
    ]
    return any(marker in prompt for marker in conceptual_markers)


def generate_mentor_hint(
    code: str,
    error: str | None,
    error_line: int | None,
    trace_context: str,
    user_question: str | None,
    mode: str,
    user_history: str | None,
) -> dict[str, Any]:
    api_key = os.environ.get("GEMINI_API_KEY")
    fallback = build_fallback(mode, error_line)

    if not api_key:
        return fallback

    prompt_sections = [
        f"Mode: {mode}",
        f"Code:\n{code or 'No code provided.'}",
        f"Error: {error or 'None'}",
        f"Error line: {error_line if error_line is not None else 'None'}",
        f"Trace context:\n{trace_context or 'None'}",
        f"User question: {user_question or 'None'}",
        f"User history:\n{user_history or 'None'}",
    ]

    if mode == "reactive":
        prompt_sections.append(
            "Respond with a Socratic question plus metaphor about the failing line. Do not explain the fix."
        )
        hint_type = "socratic"
    elif mode == "proactive":
        prompt_sections.append("Respond with one gentle question only. Keep it brief.")
        hint_type = "proactive"
    else:
        if is_conceptual_question(user_question, mode, error):
            prompt_sections.append(
                "This is a conceptual question. Give a concise explanation while still avoiding direct code fixes."
            )
            hint_type = "conceptual"
        else:
            prompt_sections.append(
                "This is a debugging-oriented question. Use Socratic guidance and avoid directly identifying the fix."
            )
            hint_type = "socratic"

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            DEFAULT_MODEL,
            system_instruction=SYSTEM_PROMPT,
        )
        response = model.generate_content("\n\n".join(prompt_sections))
        message = (getattr(response, "text", "") or "").strip()
        if not message:
            return fallback
        return {"message": message, "hint_type": hint_type}
    except Exception as exc:
        logger.warning("Gemini mentor fallback triggered: %s", exc)
        return fallback
