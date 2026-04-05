from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Agent, CallRecord, FollowUp
from app.schemas.schemas import FollowUpCreate, FollowUpOut
from app.services.pabbly import send_followup_webhook
from app.api.deps import get_current_agent

router = APIRouter(prefix="/followups", tags=["follow-ups"])


@router.post("/{call_id}", response_model=FollowUpOut, status_code=status.HTTP_201_CREATED)
async def create_followup(
    call_id: str,
    followup_in: FollowUpCreate,
    db: Session = Depends(get_db),
    agent: Agent = Depends(get_current_agent),
):
    call = db.query(CallRecord).filter(CallRecord.id == call_id, CallRecord.agent_id == agent.id).first()
    if not call:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Call not found"
        )

    followup = FollowUp(call_id=call_id, **followup_in.model_dump())
    db.add(followup)
    db.commit()
    db.refresh(followup)

    sent = await send_followup_webhook({
        "followup_id": followup.id,
        "call_id": call_id,
        "task": followup.task,
        "due_date": str(followup.due_date) if followup.due_date else None,
        "agent_name": agent.name,
        "agent_email": agent.email,
    })
    followup.pabbly_triggered = sent
    db.commit()
    return followup


@router.get("/{call_id}", response_model=list[FollowUpOut])
def list_followups(call_id: str, db: Session = Depends(get_db), agent: Agent = Depends(get_current_agent)):
    call = db.query(CallRecord).filter(CallRecord.id == call_id, CallRecord.agent_id == agent.id).first()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    return db.query(FollowUp).filter(FollowUp.call_id == call_id).all()


@router.patch("/{followup_id}/complete", response_model=FollowUpOut)
def complete_followup(followup_id: str, db: Session = Depends(get_db), agent: Agent = Depends(get_current_agent)):
    followup = db.query(FollowUp).filter(FollowUp.id == followup_id).first()
    if not followup:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    followup.status = "completed"
    db.commit()
    db.refresh(followup)
    return followup
