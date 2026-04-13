from __future__ import annotations
"""
Class Centers & Batches API — manage Robotics class venues and schedules,
plus lead enrollment assignment and schedule-sharing (Pabbly / future WhatsApp).
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_agent
from app.core.database import get_db
from app.models.models import Agent, ClassBatch, ClassCenter, Lead
from app.schemas.schemas import (
    ClassBatchCreate,
    ClassBatchOut,
    ClassBatchUpdate,
    ClassBatchWithCenterOut,
    ClassCenterCreate,
    ClassCenterOut,
    ClassCenterUpdate,
    LeadEnrollmentUpdate,
    ScheduleShareOut,
)
from app.services.pabbly import fire_event

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/classes", tags=["classes"])

_utcnow = lambda: datetime.now(timezone.utc)  # noqa: E731


# ─────────────────────────────────────────────────────────────────────────────
# Centers
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/centers", response_model=list[ClassCenterOut])
def list_centers(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    _agent: Agent = Depends(get_current_agent),
):
    q = db.query(ClassCenter)
    if not include_inactive:
        q = q.filter(ClassCenter.is_active.is_(True))
    return q.order_by(ClassCenter.name).all()


@router.post("/centers", response_model=ClassCenterOut, status_code=status.HTTP_201_CREATED)
def create_center(
    body: ClassCenterCreate,
    db: Session = Depends(get_db),
    _agent: Agent = Depends(get_current_agent),
):
    center = ClassCenter(**body.model_dump())
    db.add(center)
    db.commit()
    db.refresh(center)
    return center


@router.patch("/centers/{center_id}", response_model=ClassCenterOut)
def update_center(
    center_id: str,
    body: ClassCenterUpdate,
    db: Session = Depends(get_db),
    _agent: Agent = Depends(get_current_agent),
):
    center = db.query(ClassCenter).filter(ClassCenter.id == center_id).first()
    if not center:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Center not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(center, field, value)
    db.commit()
    db.refresh(center)
    return center


# ─────────────────────────────────────────────────────────────────────────────
# Batches
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/centers/{center_id}/batches", response_model=list[ClassBatchOut])
def list_batches_for_center(
    center_id: str,
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    _agent: Agent = Depends(get_current_agent),
):
    center = db.query(ClassCenter).filter(ClassCenter.id == center_id).first()
    if not center:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Center not found")
    q = db.query(ClassBatch).filter(ClassBatch.center_id == center_id)
    if not include_inactive:
        q = q.filter(ClassBatch.is_active.is_(True))
    return q.order_by(ClassBatch.start_date, ClassBatch.label).all()


@router.get("/batches", response_model=list[ClassBatchWithCenterOut])
def list_all_batches(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    _agent: Agent = Depends(get_current_agent),
):
    """All active batches with their center name — used by frontend dropdowns."""
    q = db.query(ClassBatch).options(joinedload(ClassBatch.center))
    if not include_inactive:
        q = q.filter(ClassBatch.is_active.is_(True))
    batches = q.order_by(ClassBatch.start_date, ClassBatch.label).all()

    result = []
    for b in batches:
        result.append(
            ClassBatchWithCenterOut(
                id=b.id,
                center_id=b.center_id,
                label=b.label,
                start_date=b.start_date,
                end_date=b.end_date,
                time_slot=b.time_slot,
                mode=b.mode,
                capacity=b.capacity,
                is_active=b.is_active,
                created_at=b.created_at,
                center_name=b.center.name if b.center else "",
                center_mode=b.center.mode if b.center else b.mode,
            )
        )
    return result


@router.post("/batches", response_model=ClassBatchOut, status_code=status.HTTP_201_CREATED)
def create_batch(
    body: ClassBatchCreate,
    db: Session = Depends(get_db),
    _agent: Agent = Depends(get_current_agent),
):
    # Verify center exists
    center = db.query(ClassCenter).filter(ClassCenter.id == body.center_id).first()
    if not center:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Center not found")
    batch = ClassBatch(**body.model_dump())
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch


@router.patch("/batches/{batch_id}", response_model=ClassBatchOut)
def update_batch(
    batch_id: str,
    body: ClassBatchUpdate,
    db: Session = Depends(get_db),
    _agent: Agent = Depends(get_current_agent),
):
    batch = db.query(ClassBatch).filter(ClassBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(batch, field, value)
    db.commit()
    db.refresh(batch)
    return batch


# ─────────────────────────────────────────────────────────────────────────────
# Lead enrollment — PATCH /classes/leads/{lead_id}/enrollment
# ─────────────────────────────────────────────────────────────────────────────

@router.patch("/leads/{lead_id}/enrollment")
def update_lead_enrollment(
    lead_id: str,
    body: LeadEnrollmentUpdate,
    db: Session = Depends(get_db),
    _agent: Agent = Depends(get_current_agent),
):
    """
    Assign / update a lead's center, batch, and enrollment status.
    Validates that the batch belongs to the specified center.
    """
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")

    updates = body.model_dump(exclude_unset=True)

    center_id = updates.get("class_center_id", lead.class_center_id)
    batch_id = updates.get("class_batch_id", lead.class_batch_id)

    # Validate batch belongs to the center when both are provided
    if batch_id and center_id:
        batch = db.query(ClassBatch).filter(ClassBatch.id == batch_id).first()
        if not batch:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")
        if batch.center_id != center_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Batch does not belong to the specified center",
            )

    # Clearing center also clears batch
    if updates.get("class_center_id") is None and "class_center_id" in updates:
        updates["class_batch_id"] = None

    for field, value in updates.items():
        setattr(lead, field, value)

    lead.updated_at = _utcnow()
    db.commit()
    db.refresh(lead)

    # Build enriched response
    return _lead_enrollment_response(lead, db)


# ─────────────────────────────────────────────────────────────────────────────
# Share schedule — POST /classes/leads/{lead_id}/share-schedule
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/leads/{lead_id}/share-schedule", response_model=ScheduleShareOut)
async def share_schedule(
    lead_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    agent: Agent = Depends(get_current_agent),
):
    """
    Fire a Pabbly 'class.schedule_shared' event for this lead's assigned batch.
    Today this drives an email; when WhatsApp API is available, add the WA step
    to the same Pabbly workflow — no backend code change needed.
    """
    lead = (
        db.query(Lead)
        .options(joinedload(Lead.class_center), joinedload(Lead.class_batch))
        .filter(Lead.id == lead_id)
        .first()
    )
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")

    if not lead.class_batch_id or not lead.class_center_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Lead has no class assignment. Assign a center and batch first.",
        )

    center = lead.class_center
    batch = lead.class_batch

    payload = {
        "lead_id": lead.id,
        "lead_name": lead.name,
        "lead_phone": lead.phone,
        "lead_email": lead.email or "",
        "center_name": center.name if center else "",
        "center_address": center.address or "",
        "center_map_url": center.map_url or "",
        "batch_id": batch.id if batch else "",
        "batch_label": batch.label if batch else "",
        "start_date": batch.start_date.isoformat() if batch and batch.start_date else "",
        "end_date": batch.end_date.isoformat() if batch and batch.end_date else "",
        "time_slot": batch.time_slot if batch else "",
        "mode": batch.mode if batch else "",
        "agent_name": agent.name,
        "agent_email": agent.email,
    }

    # Fire async in background — never blocks the response
    background_tasks.add_task(fire_event, "class.schedule_shared", payload)

    return ScheduleShareOut(
        success=True,
        message="Schedule details queued for delivery.",
        event_fired=True,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Internal helper
# ─────────────────────────────────────────────────────────────────────────────

def _lead_enrollment_response(lead: Lead, db: Session) -> dict:
    center = None
    batch = None
    if lead.class_center_id:
        center = db.query(ClassCenter).filter(ClassCenter.id == lead.class_center_id).first()
    if lead.class_batch_id:
        batch = db.query(ClassBatch).filter(ClassBatch.id == lead.class_batch_id).first()
    return {
        "id": lead.id,
        "class_center_id": lead.class_center_id,
        "class_batch_id": lead.class_batch_id,
        "enrollment_status": lead.enrollment_status,
        "class_center_name": center.name if center else None,
        "class_batch_label": batch.label if batch else None,
        "class_batch_time_slot": batch.time_slot if batch else None,
        "updated_at": lead.updated_at,
    }
