from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from mentor import generate_mentor_hint
from sandbox import execute_code

app = FastAPI(title="AlgoRythm API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    code: str = Field(..., min_length=1)
    array_var: str = Field(..., min_length=1)


class MentorRequest(BaseModel):
    code: str = Field(..., min_length=1)
    error: str = Field(..., min_length=1)
    error_line: int
    trace_context: str = ""
    user_question: str = ""


@app.get("/")
def root():
    return {"status": "ok"}


@app.post("/analyze")
def analyze(request: AnalyzeRequest):
    return execute_code(request.code, request.array_var)


@app.post("/mentor")
def mentor(request: MentorRequest):
    return generate_mentor_hint(
        code=request.code,
        error=request.error,
        error_line=request.error_line,
        trace_context=request.trace_context,
        user_question=request.user_question,
    )
