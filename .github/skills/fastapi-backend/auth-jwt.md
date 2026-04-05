# JWT Authentication & Authorization

## Security Utilities (core/security.py)

```python
# Install: pip install PyJWT passlib[bcrypt]
from datetime import datetime, timedelta, timezone
import jwt
from jwt.exceptions import InvalidTokenError
from passlib.context import CryptContext
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    return jwt.encode(
        {"sub": subject, "exp": expire},
        settings.secret_key,
        algorithm=settings.algorithm,
    )

def decode_token(token: str) -> str:
    """Raises InvalidTokenError if token is expired, malformed, or has bad signature."""
    payload = jwt.decode(
        token,
        settings.secret_key,
        algorithms=[settings.algorithm],
    )
    return payload["sub"]  # agent_id (UUID string)
```

> **Why PyJWT?** FastAPI's official security docs now recommend `PyJWT` (`import jwt`)
> over the older `python-jose` package. PyJWT is actively maintained with a simpler API.
> Migration: `from jose import JWTError` → `from jwt.exceptions import InvalidTokenError`.

> **Modern alternative**: `pwdlib` with Argon2 (`pip install pwdlib[argon2]`) is FastAPI's
> newest recommendation for password hashing. `passlib[bcrypt]` still works fine — either is
> acceptable; just don't mix them in the same project.

---

## Auth Dependency (api/deps.py)

```python
from typing import Annotated
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jwt.exceptions import InvalidTokenError
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_token
from app.models.models import Agent

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def get_current_agent(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Agent:
    try:
        agent_id = decode_token(token)
    except InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=401, detail="Agent not found")
    return agent

# Annotated type aliases — use these in route signatures
AgentDep = Annotated[Agent, Depends(get_current_agent)]
DBDep    = Annotated[Session, Depends(get_db)]
```

> **Why Annotated aliases?** They eliminate boilerplate repetition. Every protected route
> only needs `agent: AgentDep, db: DBDep` rather than the full `Depends()` expressions.

---

## Usage in Route Handlers

```python
from app.api.deps import AgentDep, DBDep

@router.get("/calls")
def list_calls(agent: AgentDep, db: DBDep):
    return db.query(CallRecord).filter_by(agent_id=agent.id).all()

@router.get("/calls/{call_id}")
def get_call(call_id: str, agent: AgentDep, db: DBDep):
    call = db.query(CallRecord).filter_by(id=call_id, agent_id=agent.id).first()
    if not call:
        raise HTTPException(status_code=404, detail="Not found")
    return call
```

Always filter by `agent_id=agent.id` when querying — never return another agent's data.

---

## Registration Endpoint (api/auth.py)

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import DBDep
from app.core.security import hash_password, create_access_token
from app.models.models import Agent
from app.schemas.schemas import AgentCreate, AgentOut
import uuid

router = APIRouter()

@router.post("/register", response_model=AgentOut, status_code=201)
def register(body: AgentCreate, db: DBDep):
    if db.query(Agent).filter(Agent.email == body.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    agent = Agent(
        id=str(uuid.uuid4()),
        email=body.email,
        full_name=body.full_name,
        hashed_pw=hash_password(body.password),
    )
    db.add(agent); db.commit(); db.refresh(agent)
    return agent
```

## Login Endpoint — OAuth2 Form

The mobile app requires OAuth2 password form (not JSON body) to work with the
`OAuth2PasswordBearer` scheme.

```python
from fastapi.security import OAuth2PasswordRequestForm

@router.post("/login")
def login(form: OAuth2PasswordRequestForm = Depends(), db: DBDep = None):
    agent = db.query(Agent).filter(Agent.email == form.username).first()
    if not agent or not verify_password(form.password, agent.hashed_pw):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(str(agent.id))
    return {"access_token": token, "token_type": "bearer"}
```

> **Form fields**: `username` (even though we use email) and `password` — this is the
> OAuth2 spec. The mobile app sends email as `username`.
