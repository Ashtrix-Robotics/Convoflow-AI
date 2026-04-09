from pydantic import BaseModel, EmailStr
from datetime import datetime

class AgentUpdateAdmin(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    password: str | None = None
    is_active: bool | None = None

