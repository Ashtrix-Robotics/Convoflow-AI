from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import hash_password
from pydantic import BaseModel, EmailStr
from app.models.models import Agent
from app.schemas.schemas import AgentCreate, AgentOut
from app.api.deps import get_current_agent

router = APIRouter(prefix="/agents", tags=["admin-agents"])

class AgentUpdateAdmin(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    password: str | None = None
    is_active: bool | None = None

@router.get("/", response_model=list[AgentOut])
def list_agents(db: Session = Depends(get_db)):
    return db.query(Agent).all()

@router.post("/", response_model=AgentOut, status_code=status.HTTP_201_CREATED)
def create_agent(agent_in: AgentCreate, db: Session = Depends(get_db)):
    if db.query(Agent).filter(Agent.email == agent_in.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    agent = Agent(name=agent_in.name, email=agent_in.email, hashed_password=hash_password(agent_in.password))
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return agent

@router.put("/{agent_id}", response_model=AgentOut)
def update_agent(agent_id: str, update_in: AgentUpdateAdmin, db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if update_in.name:
        agent.name = update_in.name
    if update_in.email:
        agent.email = update_in.email
    if update_in.password:
        agent.hashed_password = hash_password(update_in.password)
    
    if update_in.is_active is not None:
        agent.is_active = update_in.is_active
    db.commit()
    db.refresh(agent)
    return agent

@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_agent(agent_id: str, db: Session = Depends(get_db)):
    from app.models.models import Lead
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    # Nullify lead assignments so FK constraint doesn't block deletion
    db.query(Lead).filter(Lead.assigned_agent_id == agent_id).update(
        {"assigned_agent_id": None}, synchronize_session=False
    )
    db.delete(agent)
    db.commit()
    return
