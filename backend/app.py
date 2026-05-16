from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from datetime import datetime, timedelta
import os
import uuid

app = Flask(__name__)
CORS(app, origins="*")

# ── Config ──────────────────────────────────────────────────────────────────
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
    "DATABASE_URL",
    "mysql+pymysql://root:Adil%402344@localhost/dargah_db"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET", "dargah-secret-key-change-in-prod")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(days=7)
app.config["UPLOAD_FOLDER"] = "uploads"
os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

db    = SQLAlchemy(app)
bcrypt = Bcrypt(app)
jwt   = JWTManager(app)

MONTHLY_AMOUNT = 100

# ── Models ───────────────────────────────────────────────────────────────────
class Member(db.Model):
    __tablename__ = "members"
    id         = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name       = db.Column(db.String(120), nullable=False)
    mobile     = db.Column(db.String(15), unique=True, nullable=False)
    address    = db.Column(db.Text)
    upi_id     = db.Column(db.String(100))
    password   = db.Column(db.String(200), nullable=False)
    role       = db.Column(db.String(10), default="member")   # member | admin
    join_date  = join_date = db.Column(db.Date, default=lambda: datetime.utcnow().date())
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    payments   = db.relationship("Payment", backref="member", lazy=True, cascade="all, delete")

    def to_dict(self):
        return {
            "id": self.id, "name": self.name, "mobile": self.mobile,
            "address": self.address, "upi_id": self.upi_id,
            "role": self.role, "join_date": str(self.join_date),
        }


class Payment(db.Model):
    __tablename__ = "payments"
    id           = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    member_id    = db.Column(db.String(36), db.ForeignKey("members.id"), nullable=False)
    month        = db.Column(db.String(7), nullable=False)   # YYYY-MM
    amount       = db.Column(db.Integer, default=MONTHLY_AMOUNT)
    status       = db.Column(db.String(20), default="pending")  # pending|verified|rejected
    utr          = db.Column(db.String(50))
    note         = db.Column(db.Text)
    screenshot   = db.Column(db.String(200))   # filename
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)
    verified_at  = db.Column(db.DateTime)
    verified_by  = db.Column(db.String(36))

    def to_dict(self):
        return {
            "id": self.id, "member_id": self.member_id, "month": self.month,
            "amount": self.amount, "status": self.status, "utr": self.utr,
            "note": self.note, "screenshot": self.screenshot,
            "submitted_at": str(self.submitted_at),
            "verified_at": str(self.verified_at) if self.verified_at else None,
        }

# ── Auth Routes ───────────────────────────────────────────────────────────────
@app.route("/api/register", methods=["POST"])
def register():
    d = request.json
    if Member.query.filter_by(mobile=d["mobile"]).first():
        return jsonify({"error": "Mobile already registered"}), 409
    hashed = bcrypt.generate_password_hash(d["password"]).decode("utf-8")
    m = Member(name=d["name"], mobile=d["mobile"], address=d.get("address",""),
               upi_id=d.get("upi_id",""), password=hashed)
    db.session.add(m); db.session.commit()
    token = create_access_token(identity=m.id)
    return jsonify({"token": token, "user": m.to_dict()}), 201


@app.route("/api/login", methods=["POST"])
def login():
    d = request.json
    m = Member.query.filter_by(mobile=d["mobile"]).first()
    if not m or not bcrypt.check_password_hash(m.password, d["password"]):
        return jsonify({"error": "Invalid credentials"}), 401
    token = create_access_token(identity=m.id)
    return jsonify({"token": token, "user": m.to_dict()})


@app.route("/api/me", methods=["GET"])
@jwt_required()
def me():
    member_id = get_jwt_identity()
    m = Member.query.get_or_404(member_id)
    return jsonify(m.to_dict())

# ── Member Routes (Admin) ────────────────────────────────────────────────────
@app.route("/api/members", methods=["GET"])
@jwt_required()
def get_members():
    member_id = get_jwt_identity()
    current = Member.query.get(member_id)
    if current.role != "admin":
        return jsonify({"error": "Forbidden"}), 403
    members = Member.query.filter_by(role="member").all()
    result = []
    for m in members:
        d = m.to_dict()
        payments = Payment.query.filter_by(member_id=m.id).all()
        verified = [p for p in payments if p.status == "verified"]
        d["total_paid"] = len(verified) * MONTHLY_AMOUNT
        # compute dues
        from dateutil.relativedelta import relativedelta
        months = []
        cur = m.join_date.replace(day=1)
        today = datetime.utcnow().date().replace(day=1)
        while cur <= today:
            months.append(cur.strftime("%Y-%m"))
            cur += relativedelta(months=1)
        paid_months = {p.month for p in verified}
        pend_months = {p.month for p in payments if p.status == "pending"}
        unpaid = [mo for mo in months if mo not in paid_months and mo not in pend_months]
        d["due_amount"] = len(unpaid) * MONTHLY_AMOUNT
        d["unpaid_months"] = unpaid
        result.append(d)
    return jsonify(result)


@app.route("/api/members", methods=["POST"])
@jwt_required()
def add_member():
    member_id = get_jwt_identity()
    current = Member.query.get(member_id)

    if current.role != "admin":
        return jsonify({"error": "Forbidden"}), 403

    d = request.json

    if Member.query.filter_by(mobile=d["mobile"]).first():
        return jsonify({"error": "Mobile already registered"}), 409

    hashed = bcrypt.generate_password_hash(
        d.get("password", "member123")
    ).decode("utf-8")

    m = Member(
        name=d["name"],
        mobile=d["mobile"],
        address=d.get("address", ""),
        upi_id=d.get("upi_id", ""),
        password=hashed
    )

    db.session.add(m)
    db.session.commit()

    return jsonify(m.to_dict()), 201


@app.route("/api/members/<mid>", methods=["DELETE"])
@jwt_required()
def delete_member(mid):
    member_id = get_jwt_identity()
    current = Member.query.get(member_id)

    if current.role != "admin":
        return jsonify({"error": "Forbidden"}), 403

    m = Member.query.get_or_404(mid)

    db.session.delete(m)
    db.session.commit()

    return jsonify({"message": "Deleted"})

# ── Payment Routes ────────────────────────────────────────────────────────────
@app.route("/api/payments", methods=["GET"])
@jwt_required()
def get_payments():
    member_id = get_jwt_identity()
    current = Member.query.get(member_id)

    if current.role == "admin":
        payments = Payment.query.order_by(
            Payment.submitted_at.desc()
        ).all()
    else:
        payments = Payment.query.filter_by(
            member_id=member_id
        ).order_by(
            Payment.submitted_at.desc()
        ).all()

    return jsonify([p.to_dict() for p in payments])


@app.route("/api/payments", methods=["POST"])
@jwt_required()
def submit_payment():

    member_id = get_jwt_identity()

    data = request.form if request.form else request.json

    month = data.get("month")
    utr = data.get("utr", "")
    note = data.get("note", "")

    existing = Payment.query.filter_by(
        member_id=member_id,
        month=month
    ).first()

    if existing and existing.status in ("pending", "verified"):
        return jsonify(
            {"error":"Payment already submitted for this month"}
        ),409

    screenshot=None

    if "screenshot" in request.files:
        f=request.files["screenshot"]

        fname=f"{uuid.uuid4()}_{f.filename}"

        f.save(
            os.path.join(
                app.config["UPLOAD_FOLDER"],
                fname
            )
        )

        screenshot=fname

    p=Payment(
        member_id=member_id,
        month=month,
        utr=utr,
        note=note,
        screenshot=screenshot
    )

    db.session.add(p)
    db.session.commit()

    return jsonify(p.to_dict()),201


@app.route("/api/payments/<pid>/verify", methods=["POST"])
@jwt_required()
def verify_payment(pid):
    member_id = get_jwt_identity()
    current = Member.query.get(member_id)

    if current.role != "admin":
        return jsonify({"error":"Forbidden"}),403

    p = Payment.query.get_or_404(pid)

    p.status = "verified"
    p.verified_at = datetime.utcnow()
    p.verified_by = current.id

    db.session.commit()

    return jsonify(p.to_dict())


@app.route("/api/payments/<pid>/reject", methods=["POST"])
@jwt_required()
def reject_payment(pid):
    member_id = get_jwt_identity()
    current = Member.query.get(member_id)

    if current.role != "admin":
        return jsonify({"error":"Forbidden"}),403

    p = Payment.query.get_or_404(pid)

    p.status = "rejected"

    db.session.commit()

    return jsonify(p.to_dict())


@app.route("/api/uploads/<filename>")
def serve_upload(filename):
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename)

# ── Dashboard Stats ───────────────────────────────────────────────────────────
@app.route("/api/stats", methods=["GET"])
@jwt_required()
def stats():
    member_id = get_jwt_identity()
    current = Member.query.get(member_id)
    if current.role != "admin":
        return jsonify({"error": "Forbidden"}), 403
    cur_month = datetime.utcnow().strftime("%Y-%m")
    total_members   = Member.query.filter_by(role="member").count()
    verified_cur    = Payment.query.filter_by(month=cur_month, status="verified").count()
    pending_verify  = Payment.query.filter_by(status="pending").count()
    total_collected = db.session.query(db.func.sum(Payment.amount)).filter_by(status="verified").scalar() or 0
    return jsonify({
        "total_members": total_members,
        "verified_this_month": verified_cur,
        "pending_verification": pending_verify,
        "total_collected": total_collected,
    })

# ── Reports ────────────────────────────────────────────────────────────────────
@app.route("/api/reports/monthly", methods=["GET"])
@jwt_required()
def monthly_report():
    member_id = get_jwt_identity()
    current = Member.query.get(member_id)
    if current.role != "admin":
        return jsonify({"error": "Forbidden"}), 403
    rows = db.session.query(
        Payment.month,
        db.func.count(db.case((Payment.status == "verified", 1))).label("paid"),
        db.func.count(db.case((Payment.status == "pending",  1))).label("pending"),
        db.func.sum(db.case((Payment.status == "verified", Payment.amount), else_=0)).label("collected")
    ).group_by(Payment.month).order_by(Payment.month.desc()).all()
    return jsonify([{"month": r.month, "paid": r.paid, "pending": r.pending, "collected": int(r.collected or 0)} for r in rows])

# ── Health check ──────────────────────────────────────────────────────────────
@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "timestamp": datetime.utcnow().isoformat()})

# ── Init DB + seed admin ───────────────────────────────────────────────────────
def seed():
    db.create_all()
    if not Member.query.filter_by(mobile="9440458074").first():
        hashed = bcrypt.generate_password_hash("Abzal2344").decode("utf-8")
        admin = Member(name="Admin", mobile="9440458074", role="admin", password=hashed, address="Dargah Office")
        db.session.add(admin)
        db.session.commit()
        print("✅ Admin seeded: 9440458074 / Abzal2344")

with app.app_context():
    try:
        seed()
        print("Database connected successfully")
    except Exception as e:
        print("Database error:", e)

@app.route("/reset-admin")
@app.route("/reset-admin")
def reset_admin():

    # Delete ANY admin account
    old_admin = Member.query.filter_by(
        role="admin"
    ).first()

    if old_admin:
        db.session.delete(old_admin)
        db.session.commit()

    hashed = bcrypt.generate_password_hash(
        "Abzal2344"
    ).decode("utf-8")

    new_admin = Member(
        name="Admin",
        mobile="9440458074",
        role="admin",
        password=hashed,
        address="Dargah Office"
    )

    db.session.add(new_admin)
    db.session.commit()

    return "Admin updated successfully"

if __name__ == "__main__":
    app.run(debug=True, port=5000)
