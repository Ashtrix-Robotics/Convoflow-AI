from app.core.database import SessionLocal
from app.models.models import Agent
from app.core.security import hash_password

# Create session
db = SessionLocal()

# Check if admin exists
admin = db.query(Agent).filter(Agent.email == 'admin@convoflow.ai').first()
if admin:
    print('Updating admin password...')
    admin.hashed_password = hash_password('admin123')
    db.commit()
    print('✓ Admin password updated')
else:
    print('Creating admin user...')
    admin = Agent(
        email='admin@convoflow.ai',
        name='Admin User',
        hashed_password=hash_password('admin123')
    )
    db.add(admin)
    db.commit()
    print('✓ Admin user created')

db.close()
