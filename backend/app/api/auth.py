from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import verify_password, hash_password, create_access_token
from app.models.models import Agent
from app.schemas.schemas import AgentCreate, AgentOut, TokenOut
from app.api.deps import get_current_agent

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AgentOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register(request: Request, agent_in: AgentCreate, db: Session = Depends(get_db)):
    existing = db.query(Agent).filter(Agent.email == agent_in.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered"
        )
    agent = Agent(
        name=agent_in.name,
        email=agent_in.email,
        hashed_password=hash_password(agent_in.password),
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return agent


@router.post("/login", response_model=TokenOut)
@limiter.limit("10/minute")
def login(request: Request, form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.email == form.username).first()
    if not agent or not verify_password(form.password, agent.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )
    token = create_access_token({"sub": agent.id, "email": agent.email})
    return {"access_token": token}


@router.get("/me", response_model=AgentOut)
def me(agent: Agent = Depends(get_current_agent)):
    return agent
