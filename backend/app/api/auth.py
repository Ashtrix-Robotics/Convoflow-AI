from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import verify_password, hash_password, create_access_token
from app.models.models import Agent
from app.schemas.schemas import AgentCreate, AgentOut, TokenOut
from app.api.deps import get_current_agent

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AgentOut, status_code=status.HTTP_201_CREATED)
def register(agent_in: AgentCreate, db: Session = Depends(get_db)):
    import traceback
    try:
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
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"{type(exc).__name__}: {exc}\n{traceback.format_exc()[-800:]}")


@router.post("/login", response_model=TokenOut)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
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
