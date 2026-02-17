from __future__ import annotations

from app.db.base import Base
from app.modules.ai import models as ai_models
from app.modules.audit import models as audit_models
from app.modules.auth import models as auth_models
from app.modules.billing import models as billing_models
from app.modules.creators import models as creators_models
from app.modules.ledger import models as ledger_models
from app.modules.media import models as media_models
from app.modules.messaging import models as messaging_models
from app.modules.notifications import models as notifications_models
from app.modules.onboarding import models as onboarding_models
from app.modules.payments import models as payments_models
from app.modules.posts import models as posts_models

__all__ = [
    "Base",
    "ai_models",
    "audit_models",
    "auth_models",
    "billing_models",
    "creators_models",
    "ledger_models",
    "media_models",
    "messaging_models",
    "notifications_models",
    "onboarding_models",
    "payments_models",
    "posts_models",
]
