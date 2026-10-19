import os

from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "12"))
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")

# AI assistant (OpenAI)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL")
OPENAI_REASONING_EFFORT = os.getenv("OPENAI_REASONING_EFFORT", "low")

# AI assistant limits (see CLAUDE.md). Tokens = input (incl. cache) + output.
ASSISTANT_HISTORY_MESSAGES = int(os.getenv("ASSISTANT_HISTORY_MESSAGES", "20"))  # past messages sent to the model with each question
ASSISTANT_REQUESTS_PER_MINUTE = int(os.getenv("ASSISTANT_REQUESTS_PER_MINUTE", "5"))
ASSISTANT_REQUESTS_PER_DAY = int(os.getenv("ASSISTANT_REQUESTS_PER_DAY", "100"))
ASSISTANT_MAX_TOKENS_PER_QUESTION = int(os.getenv("ASSISTANT_MAX_TOKENS_PER_QUESTION", "150000"))
ASSISTANT_DAILY_TOKENS_PER_DOCTOR = int(os.getenv("ASSISTANT_DAILY_TOKENS_PER_DOCTOR", "1000000"))
ASSISTANT_DAILY_TOKENS_TOTAL = int(os.getenv("ASSISTANT_DAILY_TOKENS_TOTAL", "5000000"))
