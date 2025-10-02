# app.py - BÜTÜN DÜZƏLİŞLƏR EDİLMİŞ, TAM VƏ YEKUN KOD (QƏTİ VERSİYA)

import os
import uuid
import click
import requests
import json
from flask import url_for
from flask import redirect
from datetime import datetime
from collections import defaultdict
from datetime import timedelta

from werkzeug.middleware.proxy_fix import ProxyFix
from flask import send_from_directory
from flask import Flask, request, jsonify, session, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from itsdangerous import URLSafeTimedSerializer, SignatureExpired
from flask_mail import Mail, Message
from sqlalchemy.dialects.sqlite import JSON as SQLJSON # Adların qarışmaması üçün JSON adını dəyişirik
from flask_migrate import Migrate
from werkzeug.utils import secure_filename

def create_payriff_signature(payload_body_json_string, secret_key):
    """
    Payriff API üçün təhlükəsizlik imzası (HMAC-SHA256) yaradır.
    """
    signature = hmac.new(
        secret_key.encode('utf-8'),
        payload_body_json_string.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    return signature.upper()


# --- Layihənin əsas qovluğunu təyin edirik ---
basedir = os.path.abspath(os.path.dirname(__file__))

# --- Tətbiqin Qurulması ---
app = Flask(__name__)
app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=24)
CORS(app, supports_credentials=True, origins=["http://127.0.0.1:5500", "http://127.0.0.1:5501", "http://localhost:8000"])

# --- Konfiqurasiya ---
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'bu-cox-gizli-bir-acardir-hec-kime-vermeyin')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['MAIL_SERVER'] = os.environ.get('MAIL_SERVER', 'localhost')
app.config['MAIL_PORT'] = int(os.environ.get('MAIL_PORT', 1025))
app.config['MAIL_USE_TLS'] = os.environ.get('MAIL_USE_TLS', 'false').lower() in ['true', 'on', '1']
app.config['MAIL_USE_SSL'] = os.environ.get('MAIL_USE_SSL', 'false').lower() in ['true', 'on', '1']
app.config['MAIL_DEFAULT_SENDER'] = os.environ.get('MAIL_DEFAULT_SENDER', 'noreply@birsinaq.az')
app.config['UPLOAD_FOLDER'] = os.path.join(basedir, 'uploads')
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(minutes=60)

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# --- Genişləndirmələrin (Extensions) Başladılması ---
db = SQLAlchemy(app)
migrate = Migrate(app, db)
bcrypt = Bcrypt(app)
mail = Mail(app)
login_manager = LoginManager(app)
s = URLSafeTimedSerializer(app.config['SECRET_KEY'])

# User klassının köhnə versiyasını silib, bunu yapışdırın
class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    contact = db.Column(db.String(100), nullable=False)
    school = db.Column(db.String(100), nullable=False)
    class_ = db.Column('class', db.String(50), nullable=False)
    department = db.Column(db.String(100), nullable=False)
    language = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(100), nullable=False)
    organizer_id = db.Column(db.Integer, db.ForeignKey('organizer.id'), nullable=True)
    affiliate_id = db.Column(db.Integer, db.ForeignKey('affiliate.id'), nullable=True)
    registration_commission = db.Column(db.Float, nullable=True) # YENİ SÜTUN
 

    # DÜZƏLİŞ: Buradakı əlaqə yeniləndi
    submissions = db.relationship('Submission', back_populates='user', cascade="all, delete-orphan")

    def get_id(self): return f"user-{self.id}"


# app.py -> Digər modellərin yanına əlavə edin

# YENİ VƏ DÜZGÜN VERSİYA
class PaymentOrder(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    order_id_payriff = db.Column(db.String(100), unique=True, nullable=True, index=True)
    custom_order_id = db.Column(db.String(100), unique=True, nullable=False, index=True) # <-- PROBLEM BU SƏTRİN OLMAMASINDA İDİ
    exam_id = db.Column(db.Integer, db.ForeignKey('exam.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    guest_session_id = db.Column(db.String(100), nullable=True)
    amount = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(50), nullable=False, default='PENDING')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    exam = db.relationship('Exam')
    user = db.relationship('User')


# app.py -> Köhnə Organizer class-ını bununla əvəz edin
class Organizer(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    contact = db.Column(db.String(100), nullable=False)
    bank_account = db.Column(db.String(16), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(100), nullable=False)
    invite_code = db.Column(db.String(10), unique=True, nullable=False)
    balance = db.Column(db.Float, nullable=False, default=0.0)
    commission_amount = db.Column(db.Float, nullable=False, default=2.0)
    can_invite_affiliates = db.Column(db.Boolean, default=False, nullable=False)
    affiliate_invite_limit = db.Column(db.Integer, default=0, nullable=False)
    affiliate_invite_code = db.Column(db.String(12), unique=True, nullable=True)
    affiliate_commission = db.Column(db.Float, default=1.0, nullable=False)
    is_approved = db.Column(db.Boolean, default=False, nullable=False) # <<< YENİ SÜTUN

    registered_students = db.relationship('User', backref='organizer', lazy=True)
    affiliates = db.relationship('Affiliate', back_populates='parent_organizer', lazy=True)

    def get_id(self): return f"organizer-{self.id}"
    
    
# app.py -> Köhnə Affiliate class-ını bununla tam əvəz edin
class Affiliate(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    contact = db.Column(db.String(100), nullable=True)
    bank_account = db.Column(db.String(16), nullable=True)
    password = db.Column(db.String(100), nullable=False)
    student_invite_code = db.Column(db.String(10), unique=True, nullable=False)
    balance = db.Column(db.Float, nullable=False, default=0.0)
    commission_rate = db.Column(db.Float, nullable=False, default=2.0)
    parent_organizer_id = db.Column(db.Integer, db.ForeignKey('organizer.id'), nullable=False)
    parent_organizer = db.relationship('Organizer', back_populates='affiliates')
    registered_students = db.relationship('User', backref='affiliate', lazy=True)

    # DÜZƏLİŞ: Bu metod class-ın içində olmalıdır
    def get_id(self):
        return f"affiliate-{self.id}"
# app.py faylında Teacher klassını bununla əvəz edin
class Teacher(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, default="Müəllim")
    email = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(100), nullable=False)
    subject_id = db.Column(db.Integer, db.ForeignKey('subject.id'), nullable=False)
    subject = db.relationship('Subject', backref='teachers')

    def get_id(self): return f"teacher-{self.id}"

class Admin(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(100), nullable=False)
    def get_id(self): return f"admin-{self.id}"

class SituationalQuestionBlock(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    exam_id = db.Column(db.Integer, db.ForeignKey('exam.id'), nullable=False)
    main_text = db.Column(db.Text, nullable=False)
    image_path = db.Column(db.String(200), nullable=True)
    questions = db.relationship('Question', backref='situational_block', lazy=True, cascade="all, delete-orphan")
    
    
class Question(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    exam_id = db.Column(db.Integer, db.ForeignKey('exam.id'), nullable=False)
    subject_id = db.Column(db.Integer, db.ForeignKey('subject.id'), nullable=False)
    situational_block_id = db.Column(db.Integer, db.ForeignKey('situational_question_block.id'), nullable=True)
    question_type = db.Column(db.String(50), nullable=False, default='closed')
    text = db.Column(db.Text, nullable=False)
    options = db.Column(SQLJSON, nullable=True)
    correct_answer = db.Column(SQLJSON, nullable=True)
    question_image_path = db.Column(db.String(200), nullable=True)
    topic = db.Column(db.String(200), nullable=True)
    difficulty = db.Column(db.String(50), nullable=True)
    video_start_time = db.Column(db.Integer, nullable=True) # YENİ SAHƏ
    
    points = db.Column(db.Integer, nullable=True, default=1)
    audio_path = db.Column(db.String(200), nullable=True)

    subject = db.relationship('Subject')
    

class ExamType(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)

class ClassName(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)

# Subject klassının köhnə versiyasını silib, bunu yapışdırın
class Subject(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)

    # DÜZƏLİŞ: Buradakı əlaqə dəqiqləşdirildi
    exams = db.relationship('ExamSubject', back_populates='subject', cascade="all, delete-orphan")

# Exam klassının köhnə versiyasını silib, bunu yapışdırın
class Exam(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    price = db.Column(db.Float, nullable=False, default=0.0) # YENİ SAHƏ
    video_url = db.Column(db.String(300), nullable=True) # YENİ SAHƏ

    duration_minutes = db.Column(db.Integer, nullable=False)
    publish_date = db.Column(db.DateTime, nullable=True)
    is_active = db.Column(db.Boolean, default=False, nullable=False)
    exam_type_id = db.Column(db.Integer, db.ForeignKey('exam_type.id'), nullable=False)
    class_name_id = db.Column(db.Integer, db.ForeignKey('class_name.id'), nullable=False)

    exam_type = db.relationship('ExamType')
    class_name = db.relationship('ClassName')
    questions = db.relationship('Question', backref='exam', lazy=True, cascade="all, delete-orphan")
    situational_blocks = db.relationship('SituationalQuestionBlock', backref='exam', lazy=True, cascade="all, delete-orphan")

    # DÜZƏLİŞ: Silinmiş 'subjects' əlaqəsi geri qaytarıldı
    subjects = db.relationship('ExamSubject', back_populates='exam', cascade="all, delete-orphan")
    submissions = db.relationship('Submission', back_populates='exam', cascade="all, delete-orphan")

    @property
    def name(self):
        return f"{self.exam_type.name} ({self.class_name.name}) - {self.title}"



class ExamSubject(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    exam_id = db.Column(db.Integer, db.ForeignKey('exam.id'), nullable=False)
    subject_id = db.Column(db.Integer, db.ForeignKey('subject.id'), nullable=False)
    weight = db.Column(db.Float, nullable=False, default=1.0)
    exam = db.relationship('Exam', back_populates='subjects')
    subject = db.relationship('Subject')

# Submission klassının köhnə versiyasını silib, bunu yapışdırın
class Submission(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    guest_name = db.Column(db.String(100), nullable=True)
    guest_email = db.Column(db.String(100), nullable=True)
    exam_id = db.Column(db.Integer, db.ForeignKey('exam.id'), nullable=False)
    score = db.Column(db.Float, nullable=False, default=0)
    submitted_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    answers = db.Column(SQLJSON, nullable=False)
    time_spent_per_question = db.Column(SQLJSON, nullable=True) # YENİ SAHƏ

    exam = db.relationship('Exam', back_populates='submissions')
    individual_answers = db.relationship('Answer', back_populates='submission', cascade="all, delete-orphan")

    # DÜZƏLİŞ: Buradakı əlaqə yeniləndi
    user = db.relationship('User', back_populates='submissions')

# app.py faylında Answer klassını bununla əvəz edin
# BU KÖHNƏ BLOKU SİLİN:
# class Answer(db.Model):
#     id = db.Column(db.Integer, primary_key=True)
#     ... (və s.)

# YERİNƏ BU YENİ BLOKU YAPIŞDIRIN:
# app.py faylındakı Answer klassını bununla əvəz edin
class Answer(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    submission_id = db.Column(db.Integer, db.ForeignKey('submission.id'), nullable=False)
    question_id = db.Column(db.Integer, db.ForeignKey('question.id'), nullable=False)
    answer_text = db.Column(db.Text, nullable=True)
    score = db.Column(db.Float, nullable=True)
    status = db.Column(db.String(50), nullable=False, default='auto_graded')
    graded_by_teacher_id = db.Column(db.Integer, db.ForeignKey('teacher.id'), nullable=True)
    teacher_feedback = db.Column(db.Text, nullable=True)
    graded_at = db.Column(db.DateTime, nullable=True)

    # Əlaqələr (Relationships)
    question = db.relationship('Question')
    graded_by = db.relationship('Teacher')
    submission = db.relationship('Submission', back_populates='individual_answers')
    
    # Şəkillər üçün yeni əlavə edilən əlaqə
    images = db.relationship('AnswerImage', backref='answer', lazy=True, cascade="all, delete-orphan")
class AnswerImage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    answer_id = db.Column(db.Integer, db.ForeignKey('answer.id'), nullable=False)
    image_path = db.Column(db.String(200), nullable=False)
    
    
    
# --- FLASK CLI COMMANDS ---
@app.cli.command("create-admin")
@click.argument("email")
@click.argument("password")
def create_admin_command(email, password):
    if Admin.query.filter_by(email=email).first():
        print(f"'{email}' adlı admin artıq mövcuddur.")
        return
    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
    db.session.add(Admin(email=email, password=hashed_password))
    db.session.commit()
    print(f"'{email}' e-poçtu ilə admin uğurla yaradıldı.")

@app.cli.command("seed-db")
def seed_db_command():
    try:
        exam_types = ["Buraxılış", "Blok", "Liseylərə Hazırlıq", "İbtidai Sinif", "MİQ"]
        # Köhnə siyahını bununla əvəz edin:
        class_names = [
          "1-ci Sinif", "2-ci Sinif", "3-cü Sinif", "4-cü Sinif", 
          "5-ci Sinif", "6-cı Sinif", "7-ci Sinif", "8-ci Sinif", 
          "9-cu Sinif", "10-cu Sinif", "11-ci Sinif"
]
        subjects = ["Azərbaycan Dili", "Ədəbiyyat", "Riyaziyyat", "Fizika", "Kimya", "Biologiya", "Tarix", "Coğrafiya", "İngilis Dili"]
        for type_name in exam_types:
            if not ExamType.query.filter_by(name=type_name).first():
                db.session.add(ExamType(name=type_name))
        for class_name in class_names:
            if not ClassName.query.filter_by(name=class_name).first():
                db.session.add(ClassName(name=class_name))
        for subject_name in subjects:
            if not Subject.query.filter_by(name=subject_name).first():
                db.session.add(Subject(name=subject_name))
        db.session.commit()
        print("Verilənlər bazası ilkin məlumatlarla uğurla dolduruldu.")
    except Exception as e:
        db.session.rollback()
        print(f"Baza doldurularkən xəta baş verdi: {e}")

# --- FLASK-LOGIN USER LOADER ---
# app.py faylında
@login_manager.user_loader
def load_user(user_id_str):
    if not user_id_str or '-' not in user_id_str: return None
    user_type, user_id = user_id_str.split('-', 1)
    
    # DÜZƏLİŞ: "affiliate": Affiliate əlavə olundu
    models = {'user': User, 'admin': Admin, 'teacher': Teacher, 'organizer': Organizer, 'affiliate': Affiliate}
    
    model = models.get(user_type)
    if model:
        return model.query.get(int(user_id))
    return None
# --- API ROUTES ---

# --- ADMIN PANEL API ---
@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    data = request.get_json()
    admin = Admin.query.filter_by(email=data.get('email')).first()
    if admin and bcrypt.check_password_hash(admin.password, data.get('password')):
        login_user(admin, remember=True, duration=timedelta(hours=24))
        return jsonify({'message': 'Admin girişi uğurludur!'})
    return jsonify({'message': 'E-poçt və ya şifrə yanlışdır'}), 401

def convert_time_to_seconds(time_str):
    """ 'MM:SS' formatındakı mətni ümumi saniyəyə çevirir. """
    if not time_str or ':' not in time_str:
        return None
    try:
        minutes, seconds = map(int, time_str.split(':'))
        return minutes * 60 + seconds
    except (ValueError, TypeError):
        return None




# app.py faylında köhnə create_exam funksiyasını silib, bunu yapışdırın

def convert_time_to_seconds(time_str):
    """ 'MM:SS' formatındakı mətni ümumi saniyəyə çevirir. """
    if not time_str or ':' not in time_str:
        return None
    try:
        minutes, seconds = map(int, time_str.split(':'))
        return minutes * 60 + seconds
    except (ValueError, TypeError):
        return None

# app.py -> Köhnə create_exam funksiyasını bununla tam əvəz edin

@app.route('/api/admin/exams', methods=['POST'])
@login_required
def create_exam():
    if not isinstance(current_user, Admin):
        return jsonify({'message': 'Yetkiniz yoxdur'}), 403
    
    try:
        data = request.form
        questions_data = json.loads(data.get('questions'))
        files = request.files
        
        publish_date = None
        if data.get('publishImmediately') == 'false' and data.get('publishDate'):
            publish_date = datetime.fromisoformat(data['publishDate'])

        new_exam = Exam(
            title=data.get('title'),
            price=float(data.get('price', 0)),
            duration_minutes=data.get('duration'),
            exam_type_id=data.get('examTypeId'),
            class_name_id=data.get('classNameId'),
            video_url=data.get('video_url'),
            is_active=(data.get('publishImmediately') == 'true'),
            publish_date=publish_date
        )
        db.session.add(new_exam)
        db.session.flush()

        for idx, q_data in enumerate(questions_data):
            question_image_filename = None
            question_image_key = f'question_image_{idx}'
            if question_image_key in files:
                file = files[question_image_key]
                if file and file.filename != '':
                    filename = secure_filename(file.filename)
                    unique_filename = str(uuid.uuid4()) + "_" + filename
                    file.save(os.path.join(app.config['UPLOAD_FOLDER'], unique_filename))
                    question_image_filename = unique_filename
            
            audio_filename = None
            audio_file_key = f'audio_file_{idx}'
            if audio_file_key in files:
                file = files[audio_file_key]
                if file and file.filename != '':
                    filename = secure_filename(file.filename)
                    unique_filename = str(uuid.uuid4()) + "_" + filename
                    file.save(os.path.join(app.config['UPLOAD_FOLDER'], unique_filename))
                    audio_filename = unique_filename

            q_type = q_data['question_type']
            
            if q_type == 'situational':
                situational_image_filename = None
                new_block = SituationalQuestionBlock(exam_id=new_exam.id, main_text=q_data['text'], image_path=situational_image_filename)
                db.session.add(new_block)
                db.session.flush()
                if 'sub_questions' in q_data['options']:
                    for sub_question_text in q_data['options']['sub_questions']: 
                        sub_q = Question(exam_id=new_exam.id, subject_id=q_data.get('subject_id'), situational_block_id=new_block.id, question_type='situational_open', text=sub_question_text, video_start_time=q_data.get('video_start_time'))
                        db.session.add(sub_q)
            else:
                processed_options = q_data['options']
                if q_type == 'closed':
                    processed_options_with_images = []
                    # --- DÜZƏLİŞ BURADADIR ---
                    for option_data in q_data['options']: 
                        variant = option_data.get('variant')
                        option_text = option_data.get('text')
                        option_image_filename = None
                        option_image_key = f'option_image_{idx}_{variant}'
                        if option_image_key in files:
                            file = files[option_image_key]
                            if file and file.filename != '':
                                filename = secure_filename(file.filename)
                                unique_filename = str(uuid.uuid4()) + "_" + filename
                                file.save(os.path.join(app.config['UPLOAD_FOLDER'], unique_filename))
                                option_image_filename = unique_filename
                        processed_options_with_images.append({
                            "variant": variant, 
                            "text": option_text, 
                            "image_path": option_image_filename
                        })
                    processed_options = processed_options_with_images
                # --- DÜZƏLİŞİN SONU ---

                new_question = Question(
                    exam_id=new_exam.id, 
                    subject_id=q_data.get('subject_id'), 
                    points=q_data.get('points', 1),
                    question_type=q_data.get('question_type'), 
                    text=q_data.get('text'), 
                    options=processed_options, 
                    correct_answer=q_data.get('correct_answer'),
                    video_start_time=q_data.get('video_start_time'),
                    topic=q_data.get('topic'),
                    difficulty=q_data.get('difficulty'),
                    question_image_path=question_image_filename,
                    audio_path=audio_filename
                )
                db.session.add(new_question)

        db.session.commit()
        return jsonify({'message': 'İmtahan uğurla yaradıldı!'}), 201

    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({'message': f'İmtahan yaradılarkən daxili xəta baş verdi: {str(e)}'}), 500
    
@app.route('/api/admin/students')
@login_required
def get_all_students_with_submissions():
    if not isinstance(current_user, Admin): return jsonify({'message': 'Yetkiniz yoxdur'}), 403
    students = User.query.all()
    student_list = [{'id': s.id, 'name': s.name, 'email': s.email, 'school': s.school, 'class': s.class_, 'submissions': [{'examName': sub.exam.title, 'score': sub.score, 'submittedAt': sub.submitted_at.strftime('%Y-%m-%d %H:%M')} for sub in s.submissions]} for s in students]
    guest_submissions = Submission.query.filter(Submission.user_id == None).all()
    guest_list = [{'guestName': sub.guest_name, 'examName': sub.exam.title, 'score': sub.score, 'submittedAt': sub.submitted_at.strftime('%Y-%m-%d %H:%M')} for sub in guest_submissions]
    return jsonify({'registeredStudents': student_list, 'guestSubmissions': guest_list})

@app.route('/api/admin/exams', methods=['GET'])
@login_required
def get_all_exams():
    if not isinstance(current_user, Admin): return jsonify({'message': 'Yetkiniz yoxdur'}), 403
    exams = Exam.query.order_by(Exam.id.desc()).all()
    exam_list = [{'id': exam.id, 'name': exam.name, 'is_active': exam.is_active, 'question_count': len(exam.questions)} for exam in exams]
    return jsonify(exam_list)

@app.route('/api/admin/exams/<int:exam_id>', methods=['DELETE'])
@login_required
def delete_exam(exam_id):
    if not isinstance(current_user, Admin):
        return jsonify({'message': 'Yetkiniz yoxdur'}), 403

    exam = Exam.query.get_or_404(exam_id)

    try:
        # Əvvəlcə bu imtahana aid olan bütün asılı məlumatları silirik
        PaymentOrder.query.filter_by(exam_id=exam_id).delete()
        Submission.query.filter_by(exam_id=exam_id).delete()

        # Sonra imtahanın özünü silirik
        db.session.delete(exam)
        db.session.commit()
        return jsonify({'message': 'İmtahan və ona bağlı bütün nəticələr/sifarişlər uğurla silindi!'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Xəta baş verdi: {str(e)}'}), 500

@app.route('/api/admin/exam-meta', methods=['GET'])
@login_required
def get_exam_meta():
    if not isinstance(current_user, Admin): return jsonify({'message': 'Yetkiniz yoxdur'}), 403
    return jsonify({
        'examTypes': [{'id': et.id, 'name': et.name} for et in ExamType.query.all()],
        'classNames': [{'id': cn.id, 'name': cn.name} for cn in ClassName.query.all()],
        'subjects': [{'id': s.id, 'name': s.name} for s in Subject.query.all()]
    })


# app.py -> FAYLIN SONUNA ƏLAVƏ EDİN

from flask import url_for, render_template

@app.route('/payment-status')
def payment_status_page():
    """
    İstifadəçini ödənişdən sonra yönləndirdiyimiz səhifə.
    Bu səhifə arxa planda statusu yoxlayacaq.
    """
    order_id = request.args.get('orderID')
    return render_template('payment-status.html', orderID=order_id)

@app.route('/api/check-payment-status/<order_id>')
def check_payment_status(order_id):
    """
    JavaScript tərəfindən statusu yoxlamaq üçün çağırılan ünvan.
    """
    order = PaymentOrder.query.filter_by(custom_order_id=order_id).first()
    if order:
        if order.status == 'APPROVED':
            # Ödəniş uğurludursa, imtahana yönlənmək üçün URL qaytarırıq
            exam_url = url_for('serve_static_files', path=f'exam-test.html?examId={order.exam_id}')
            return jsonify({'status': 'APPROVED', 'redirectUrl': exam_url})
        elif order.status == 'FAILED':
            return jsonify({'status': 'FAILED'})
        else: # Hələ də PENDING-dir
            return jsonify({'status': 'PENDING'})
    return jsonify({'status': 'NOT_FOUND'}), 404

@app.route('/api/payriff/webhook', methods=['POST'])
def payriff_webhook():
    data = request.get_json()
    print("--- PAYRIFF WEBHOOK RECEIVED ---", data)

    try:
        payload = data.get('payload')
        if not payload:
            return jsonify({'status': 'error', 'message': 'Payload not found'}), 400

        order_status = payload.get('transactionStatus', payload.get('orderStatus')) # Bəzən fərqli adla gələ bilir
        custom_order_id = payload.get('orderID') # Bizim göndərdiyimiz ID

        order = PaymentOrder.query.filter_by(custom_order_id=custom_order_id).first()
        if not order:
            return jsonify({'status': 'error', 'message': 'Order not found'}), 404

        if order.status == 'APPROVED': # Artıq təsdiqlənibsə, təkrar əməliyyat etmə
            return jsonify({'status': 'ok', 'message': 'Already approved'}), 200

        if order_status == 'APPROVED':
            order.status = 'APPROVED'
            exam = order.exam
            
            # Komissiya hesablanması
            if exam and exam.price > 0:
                user = User.query.get(order.user_id) if order.user_id else None
                if user:
                    if user.organizer_id and not user.affiliate_id:
                        organizer = Organizer.query.get(user.organizer_id)
                        if organizer:
                            organizer.balance += organizer.commission_amount
                    elif user.affiliate_id:
                        affiliate = Affiliate.query.get(user.affiliate_id)
                        if affiliate:
                            affiliate.balance += affiliate.commission_rate
                            if affiliate.parent_organizer:
                                affiliate.parent_organizer.balance += affiliate.parent_organizer.affiliate_commission
        else:
            order.status = 'FAILED'

        db.session.commit()
        return jsonify({'status': 'ok'}), 200

    except Exception as e:
        db.session.rollback()
        print(f"--- PAYRIFF WEBHOOK CRITICAL ERROR ---: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

# --- STUDENT & GENERAL API ---
@app.route('/api/profile')
@login_required
def profile():
    if not isinstance(current_user, User):
        return jsonify({'message': 'Yetkiniz yoxdur'}), 403

    submission_history = []
    for sub in sorted(current_user.submissions, key=lambda x: x.submitted_at, reverse=True):
        submission_history.append({
            'id': sub.id,
            'exam_title': sub.exam.title,
            'score': sub.score,
            'date': sub.submitted_at.strftime('%Y-%m-%d %H:%M'),
            'exam_id': sub.exam_id  # <<< ƏSAS OLAN BU SƏTİRDİR
        })

    return jsonify({
        'name': current_user.name, 'contact': current_user.contact, 'school': current_user.school,
        'class': current_user.class_, 'department': current_user.department, 'language': current_user.language,
        'submission_history': submission_history
    })

@app.route('/api/exams/categories')
def get_exam_categories():
    try:
        active_exams = Exam.query.filter_by(is_active=True).all()
        categories = defaultdict(set)
        for exam in active_exams:
            categories[exam.exam_type.name].add(exam.class_name.name)
        result = {key: sorted(list(value)) for key, value in categories.items()}
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/exams')
def get_exams_by_category():
    try:
        exam_type_name = request.args.get('type')
        class_name_str = request.args.get('grade')
        if not exam_type_name or not class_name_str:
            return jsonify({"error": "İmtahan növü və sinif tələb olunur"}), 400

        exam_type = ExamType.query.filter_by(name=exam_type_name).first()
        class_name_obj = ClassName.query.filter_by(name=class_name_str).first()
        if not exam_type or not class_name_obj:
            return jsonify([])

        exams = Exam.query.filter_by(is_active=True, exam_type_id=exam_type.id, class_name_id=class_name_obj.id).all()
        
        # YENİ HİSSƏ BAŞLAYIR
        taken_exam_ids = set()
        if current_user.is_authenticated and isinstance(current_user, User):
            # İstifadəçinin artıq iştirak etdiyi imtahanların ID-lərini tapırıq
            submissions = Submission.query.filter_by(user_id=current_user.id).all()
            taken_exam_ids = {sub.exam_id for sub in submissions}

        exam_list = []
        for exam in exams:
            exam_list.append({
                'id': exam.id,
                'title': exam.title,
                'price': exam.price,
                'is_taken': exam.id in taken_exam_ids  # Hər imtahan üçün iştirak edilib/edilmədiyi qeyd olunur
            })
        # YENİ HİSSƏ BİTİR

        return jsonify(exam_list)
    except Exception as e:
        print(f"Error in /api/exams: {e}")
        return jsonify({"error": "Daxili server xətası"}), 500

# app.py -> Köhnə get_exam_for_test funksiyasını bununla əvəz edin

@app.route('/api/exam-test/<int:exam_id>')
def get_exam_for_test(exam_id):
    exam = Exam.query.filter_by(id=exam_id, is_active=True).first_or_404("İmtahan tapılmadı və ya aktiv deyil.")

    # --- TƏHLÜKƏSİZLİK YOXLAMASI BAŞLAYIR ---
    has_access = False
    
    # 1. Əgər imtahan pulsuzdursa, hər kəsə icazə ver
    if exam.price <= 0:
        has_access = True
    else:
        # 2. Əgər istifadəçi qeydiyyatlıdırsa
        if current_user.is_authenticated and isinstance(current_user, User):
            # Təsdiqlənmiş ödənişi olub-olmadığını yoxla
            paid_order = PaymentOrder.query.filter_by(user_id=current_user.id, exam_id=exam_id, status='APPROVED').first()
            if paid_order:
                has_access = True
        
        # 3. Əgər istifadəçi qonaqdırsa
        elif 'guest_session_id' in session:
            guest_session_id = session['guest_session_id']
            # Bu sessiya üçün təsdiqlənmiş ödənişi yoxla
            paid_order = PaymentOrder.query.filter_by(guest_session_id=guest_session_id, exam_id=exam_id, status='APPROVED').first()
            if paid_order:
                has_access = True

    if not has_access:
        return jsonify({"error": "Bu imtahanda iştirak etmək üçün ödəniş etməlisiniz."}), 403
    # --- TƏHLÜKƏSİZLİK YOXLAMASI BİTİR ---

    # Qalan kod olduğu kimi qalır...
    try:
        normal_questions_data = []
        for q in exam.questions:
            if q.situational_block_id is None:
                subject_name = q.subject.name if q.subject else "Təyin edilməyib"
                normal_questions_data.append({
                    'id': q.id, 'subject': subject_name, 'question_type': q.question_type, 'text': q.text, 
                    'options': q.options, 'question_image_path': q.question_image_path, 'audio_path': q.audio_path
                })
        
        situational_blocks_data = []
        # ... (qalan kodunuz olduğu kimi qalır)

        return jsonify({'id': exam.id, 'title': exam.name, 'duration': exam.duration_minutes, 'normal_questions': normal_questions_data, 'situational_blocks': situational_blocks_data})
    except Exception as e:
        return jsonify({"error": f"İmtahan məlumatlarını yükləmək mümkün olmadı: {str(e)}"}), 500
# app.py faylında bu funksiyanı tapıb AŞAĞIDAKI KODLA TAM ƏVƏZ EDİN

# app.py -> submit_exam funksiyasını bununla tam əvəz edin
# app.py -> Köhnə submit_exam funksiyasını bununla əvəz edin

# app.py -> Köhnə /api/exam/submit funksiyasını bununla əvəz edin
# app.py -> Köhnə submit_exam funksiyasını bununla tam əvəz edin

@app.route('/api/exam/submit', methods=['POST'])
def submit_exam():
    try:
        form_data = request.form
        files = request.files
        
        exam_id = form_data.get('examId')
        # Cavabları JSON-dan lüğətə (dictionary) çeviririk
        user_answers_dict = json.loads(form_data.get('answers', '{}'))
        time_spent = json.loads(form_data.get('timeSpent', '{}'))

        exam = Exam.query.get(exam_id)
        if not exam:
            return jsonify({'error': 'İmtahan tapılmadı'}), 404

        # 1. Əsas "Submission" obyektini yaradırıq
        new_submission = Submission(
            exam_id=exam_id,
            score=0, # İlkin bal 0 olur, sonra hesablanacaq
            answers=user_answers_dict, # Ümumi cavabları JSON olaraq saxlayırıq
            time_spent_per_question=time_spent
        )
        
        user_who_submitted = None
        if current_user.is_authenticated and isinstance(current_user, User):
            new_submission.user_id = current_user.id
            user_who_submitted = current_user
        else:
            new_submission.guest_name = form_data.get('guestName')
            new_submission.guest_email = form_data.get('guestEmail')

        db.session.add(new_submission)
        db.session.flush() # ID-ni əldə etmək üçün

        # 2. HƏR BİR CAVABI AYRILIQDA BAZAYA YAZMAQ ÜÇÜN YENİ BLOK
        all_exam_questions = {q.id: q for q in exam.questions}
        created_answers = {}

        for q_id_str, student_answer in user_answers_dict.items():
            q_id = int(q_id_str)
            question = all_exam_questions.get(q_id)
            if not question:
                continue

            # JSON-a çevirməyə çalışırıq, alınmasa olduğu kimi götürürük
            try:
                student_answer_text = json.dumps(student_answer)
            except TypeError:
                student_answer_text = str(student_answer)

            new_answer = Answer(
                submission_id=new_submission.id,
                question_id=q_id,
                answer_text=student_answer_text,
            )

            # AVTOMATİK QİYMƏTLƏNDİRMƏ
            if question.question_type in ['situational_open', 'open_written']:
                new_answer.status = 'pending_review'
                new_answer.score = 0
            else:
                # Düzgün cavabı müqayisə üçün hazırlayırıq
                correct_answer = question.correct_answer
                # Burada sadə müqayisə aparırıq, daha mürəkkəb yoxlama da əlavə oluna bilər
                if str(student_answer).lower() == str(correct_answer).lower():
                    new_answer.score = 1.0
                else:
                    new_answer.score = 0.0
                new_answer.status = 'graded'
            
            db.session.add(new_answer)
            created_answers[q_id] = new_answer
        
        db.session.flush() # Cavabların ID-lərini əldə etmək üçün

        # 3. Şəkil yüklənən cavabları emal edirik
        for key, file in files.items():
            if key.startswith('images_'):
                q_id = int(key.split('_')[1])
                
                # Əgər bu sual üçün artıq cavab yaranıbsa, onu istifadə edirik
                answer_obj = created_answers.get(q_id)
                if not answer_obj:
                    answer_obj = Answer(submission_id=new_submission.id, question_id=q_id, status='pending_review', score=0)
                    db.session.add(answer_obj)
                    db.session.flush()
                
                filename = secure_filename(file.filename)
                unique_filename = str(uuid.uuid4()) + "_" + filename
                file.save(os.path.join(app.config['UPLOAD_FOLDER'], unique_filename))
                
                new_image = AnswerImage(answer_id=answer_obj.id, image_path=unique_filename)
                db.session.add(new_image)

        # 4. Yekun balı hesablayıb Submission-u yeniləyirik
        final_stats = calculate_detailed_score(new_submission)
        new_submission.score = final_stats.get('final_score', 0)

        # 5. İmtahan ödənişli olduqda komissiyaları hesablamaq üçün YENİ BLOK
        if exam.price > 0 and user_who_submitted:
            # Ssenari 1: Şagirdi birbaşa Kordinator cəlb edibsə
            if user_who_submitted.organizer_id and not user_who_submitted.affiliate_id:
                organizer = Organizer.query.get(user_who_submitted.organizer_id)
                if organizer:
                    organizer.balance += organizer.commission_amount
            
            # Ssenari 2: Şagirdi Əlaqələndirici cəlb edibsə
            elif user_who_submitted.affiliate_id:
                affiliate = Affiliate.query.get(user_who_submitted.affiliate_id)
                if affiliate:
                    # 1. Əlaqələndiricinin balansını öz komissiyası qədər artırırıq
                    affiliate.balance += affiliate.commission_rate
                    
                    # 2. Kordinatorun balansını heç nə çıxmadan, tam məbləğdə artırırıq
                    parent_organizer = affiliate.parent_organizer
                    if parent_organizer:
                        parent_organizer.balance += parent_organizer.commission_amount

        db.session.commit()
        session['last_submission_id'] = new_submission.id
        return jsonify({'message': 'İmtahan uğurla təqdim edildi!', 'submission_id': new_submission.id})

    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Daxili xəta baş verdi: {str(e)}'}), 500


@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    user = User.query.filter_by(email=data['email']).first()
    if user and bcrypt.check_password_hash(user.password, data['password']):
        login_user(user, remember=True, duration=timedelta(hours=24))

        # ===========================================================================
        # YENİ ƏLAVƏ EDİLMİŞ BLOK: Qonaq imtahanlarını mövcud hesaba bağlayırıq
        # ===========================================================================
        try:
            # İstifadəçinin e-poçtu ilə uyğun gələn bütün sahibsiz qonaq imtahanlarını tapırıq
            guest_submissions = Submission.query.filter_by(guest_email=user.email, user_id=None).all()
            
            if guest_submissions:
                for sub in guest_submissions:
                    sub.user_id = user.id
                    sub.guest_name = None  # Artıq qonaq deyil
                    sub.guest_email = None # Artıq qonaq deyil

                    # Əgər şagirdin təşkilatçısı varsa, onun əvvəlki qonaq imtahanları üçün də balans artır
                    if user.organizer:
                        user.organizer.balance += user.organizer.commission_amount

                
                db.session.commit()
        except Exception as e:
            # Hər hansı bir xəta baş verərsə, login prosesinin dayanmaması üçün xətanı qeyd edib davam edirik
            db.session.rollback()
            print(f"Error while linking guest submissions during login for user {user.email}: {e}")
        # ===========================================================================
        # YENİ BLOKUN SONU
        # ===========================================================================

        return jsonify({'message': 'Giriş uğurludur!'})
    
    return jsonify({'message': 'E-poçt və ya şifrə yanlışdır'}), 401



@app.route('/api/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({'message': 'Uğurla çıxış edildi'})

@app.route('/api/forgot-password', methods=['POST'])
def forgot_password():
    data = request.get_json()
    user = User.query.filter_by(email=data['email']).first()
    if user:
        token = s.dumps(user.email, salt='password-reset-salt')
        reset_url = f"http://127.0.0.1:5501/reset-password.html?token={token}"
        msg = Message("Şifrəni Bərpa Et", recipients=[user.email], body=f"Şifrənizi yeniləmək üçün bu linkə daxil olun: {reset_url}")
        mail.send(msg)
    return jsonify({'message': 'Əgər e-poçt ünvanınız sistemdə mövcuddursa, sizə şifrə bərpa linki göndərildi.'})

@app.route('/api/reset-password/<token>', methods=['POST'])
def reset_password(token):
    try:
        email = s.loads(token, salt='password-reset-salt', max_age=3600)
    except (SignatureExpired, Exception):
        return jsonify({'message': 'Link etibarsızdır və ya vaxtı bitib.'}), 400
    data = request.get_json()
    user = User.query.filter_by(email=email).first()
    if user:
        user.password = bcrypt.generate_password_hash(data['password']).decode('utf-8')
        db.session.commit()
        return jsonify({'message': 'Şifrəniz uğurla yeniləndi!'})
    return jsonify({'message': 'İstifadəçi tapılmadı.'}), 404

# --- TEACHER API ---
@app.route('/api/teacher/login', methods=['POST'])
def teacher_login():
    data = request.get_json()
    teacher = Teacher.query.filter_by(email=data.get('email')).first()
    if teacher and bcrypt.check_password_hash(teacher.password, data.get('password')):
        login_user(teacher, remember=True, duration=timedelta(hours=24))
        return jsonify({'message': 'Müəllim girişi uğurludur!'})
    return jsonify({'message': 'E-poçt və ya şifrə yanlışdır'}), 401

# --- ORGANIZER API ---
# app.py -> Köhnə organizer_register funksiyasını bununla tam əvəz edin

# app.py -> Köhnə organizer_register funksiyasını bununla tam əvəz edin

@app.route('/api/organizer/register', methods=['POST'])
def organizer_register():
    data = request.get_json()
    if Organizer.query.filter_by(email=data['email']).first():
        return jsonify({'message': 'Bu e-poçt artıq qeydiyyatdan keçib'}), 409

    hashed_password = bcrypt.generate_password_hash(data['password']).decode('utf-8')

    # Şagird dəvət kodu (unikal olmalıdır)
    student_invite_code = str(uuid.uuid4().hex)[:8]
    while Organizer.query.filter_by(invite_code=student_invite_code).first():
        student_invite_code = str(uuid.uuid4().hex)[:8]

    # Əlaqələndirici dəvət kodu (unikal olmalıdır)
    affiliate_invite_code = str(uuid.uuid4().hex)[:10]
    while Organizer.query.filter_by(affiliate_invite_code=affiliate_invite_code).first():
        affiliate_invite_code = str(uuid.uuid4().hex)[:10]

    new_organizer = Organizer(
        name=data['name'],
        contact=data.get('contact'),
        bank_account=data.get('bank-account'),
        email=data['email'],
        password=hashed_password,
        invite_code=student_invite_code,
        affiliate_invite_code=affiliate_invite_code # <<< ƏSAS DÜZƏLİŞ BURADADIR
    )
    db.session.add(new_organizer)
    db.session.commit()
    return jsonify({'message': 'Qeydiyyat uğurlu oldu!'}), 201

# app.py -> Köhnə organizer_login funksiyasını bununla tam əvəz edin

@app.route('/api/organizer/login', methods=['POST'])
def organizer_login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    organizer = Organizer.query.filter_by(email=email).first()
    if organizer and bcrypt.check_password_hash(organizer.password, password):
        # YENİ YOXLAMA
        if not organizer.is_approved:
            return jsonify({'message': 'Hesabınız hələ admin tərəfindən təsdiqlənməyib.'}), 403
        
        login_user(organizer, remember=True, duration=timedelta(hours=24))
        return jsonify({'message': 'Giriş uğurludur!'})

    affiliate = Affiliate.query.filter_by(email=email).first()
    if affiliate and bcrypt.check_password_hash(affiliate.password, password):
        login_user(affiliate, remember=True, duration=timedelta(hours=24))
        return jsonify({'message': 'Giriş uğurludur!'})

    return jsonify({'message': 'E-poçt və ya şifrə yanlışdır'}), 401

@app.route('/api/organizer/update', methods=['POST'])
@login_required
def organizer_update():
    if not isinstance(current_user, Organizer): return jsonify({'message': 'Yetkiniz yoxdur'}), 403
    data = request.get_json()
    organizer = Organizer.query.get(current_user.id)
    if 'email' in data and data['email'] != organizer.email and Organizer.query.filter_by(email=data['email']).first():
        return jsonify({'message': 'Bu e-poçt artıq istifadə olunur'}), 409
    organizer.name = data.get('name', organizer.name)
    organizer.contact = data.get('contact', organizer.contact)
    organizer.bank_account = data.get('bank_account', organizer.bank_account)
    organizer.email = data.get('email', organizer.email)
    db.session.commit()
    return jsonify({'message': 'Məlumatlar uğurla yeniləndi!'})


# --- SCORING & RESULTS ---
# app.py faylında bu funksiyanı tapıb tam əvəz edin

# app.py -> Köhnə calculate_detailed_score funksiyasını bununla tam əvəz edin

def calculate_detailed_score(submission):
    exam = submission.exam
    exam_type_name = exam.exam_type.name
    all_answers = submission.individual_answers

    subject_stats = defaultdict(lambda: {
        'correct': 0, 'incorrect': 0, 'unanswered': 0, 'score': 0,
        'correct_closed': 0, 'incorrect_closed': 0, 'written_score_sum': 0
    })
    
    # Hər fənnə aid ümumi sual sayını hesablamaq üçün
    total_questions_by_subject = defaultdict(int)
    for q in exam.questions:
        if q.subject:
            total_questions_by_subject[q.subject.name] += 1

    for answer_obj in all_answers:
        question = answer_obj.question
        if not question or not question.subject:
            continue
        
        subject_name = question.subject.name
        s_stats = subject_stats[subject_name]

        if not answer_obj.answer_text or answer_obj.answer_text in ['[]', '""', '{}']:
            s_stats['unanswered'] += 1
            continue

        if answer_obj.status == 'graded' and answer_obj.score is not None:
            if answer_obj.score > 0:
                s_stats['correct'] += 1
                if question.question_type == 'closed':
                    s_stats['correct_closed'] += 1
                # Yazılı suallardan gələn xalı toplayırıq (məsələn, 1/3, 1/2 və ya tam bal)
                s_stats['written_score_sum'] += answer_obj.score * (question.points or 1)
            else:
                s_stats['incorrect'] += 1
                if question.question_type == 'closed':
                    s_stats['incorrect_closed'] += 1
    
    final_score = 0
    
    # "Buraxılış" və "Blok" üçün xüsusi mürəkkəb hesablama
    if exam_type_name in ["Buraxılış", "Blok"]:
        total_exam_score = 0
        total_question_count = len(exam.questions)
        for subject_name, s_stats in subject_stats.items():
            net_correct_closed = s_stats['correct_closed'] - (s_stats['incorrect_closed'] / 4.0)
            if net_correct_closed < 0: net_correct_closed = 0
            
            other_correct_points = 0
            # Açıq tipli (amma yazılı olmayan) sualların xallarını toplayırıq
            for ans in all_answers:
                if ans.question and ans.question.subject.name == subject_name and ans.question.question_type != 'closed' and ans.question.question_type != 'situational_open':
                    if ans.score and ans.score > 0:
                        other_correct_points += ans.question.points or 1

            subject_raw_score = net_correct_closed + other_correct_points + s_stats['written_score_sum']
            s_stats['score'] = round(subject_raw_score, 2)
            total_exam_score += subject_raw_score
            
        max_possible_raw_score = total_question_count
        if max_possible_raw_score > 0:
            scale_factor = 300 if exam_type_name == "Buraxılış" else 400
            final_score = round((total_exam_score / max_possible_raw_score) * scale_factor)

    # DİGƏR BÜTÜN İMTAHAN NÖVLƏRİ ÜÇÜN BALLARIN CƏMİ
    else:
        total_points_earned = 0
        for subject_name, s_stats in subject_stats.items():
            subject_score = 0
            # Bu fənnə aid cavabları tapırıq
            subject_answers = [a for a in all_answers if a.question and a.question.subject.name == subject_name]
            for ans in subject_answers:
                if ans.score and ans.score > 0:
                    # Düzgün cavabın xalını toplayırıq
                    subject_score += (ans.question.points or 1) * ans.score
            
            s_stats['score'] = round(subject_score, 2)
            total_points_earned += subject_score
        
        final_score = round(total_points_earned)

    return {
        'correct_count': sum(s['correct'] for s in subject_stats.values()),
        'incorrect_count': sum(s['incorrect'] for s in subject_stats.values()),
        'unanswered_count': sum(s['unanswered'] for s in subject_stats.values()),
        'final_score': final_score,
        'subjects': dict(subject_stats)
    }
    
    
# app.py

# app.py -> Köhnə get_submission_result funksiyasını bununla TAM ƏVƏZ EDİN

# app.py -> Köhnə get_submission_result funksiyasını bununla tam əvəz edin

@app.route('/api/submission/<int:submission_id>/result')
def get_submission_result(submission_id):
    submission = Submission.query.get_or_404(submission_id)
    can_view = False

    if (current_user.is_authenticated and isinstance(current_user, User) and submission.user_id == current_user.id) or \
       ('last_submission_id' in session and session['last_submission_id'] == submission_id):
        can_view = True

    if not can_view:
        return jsonify({'message': 'Bu nəticəyə baxmaq üçün icazəniz yoxdur'}), 403

    exam = submission.exam
    # Bütün cavabları bir lüğətə yığırıq ki, asanlıqla tapa bilək
    submitted_answers_map = {ans.question_id: ans for ans in submission.individual_answers}

    results_by_subject = defaultdict(list)

    # İmtahandakı BÜTÜN sualların üstündən keçirik
    all_questions = sorted(exam.questions, key=lambda q: q.id)
    
    for question in all_questions:
        student_answer_obj = submitted_answers_map.get(question.id)
        
        student_answer_text = None
        status = 'unanswered' # Standart olaraq cavabsız qəbul edirik
        
        if student_answer_obj and student_answer_obj.answer_text:
            try:
                # JSON formatında olan cavabları çeviririk (uyğunluq, fast tree)
                student_answer_text = json.loads(student_answer_obj.answer_text)
            except (json.JSONDecodeError, TypeError):
                # Əgər JSON deyilsə, olduğu kimi götürürük
                student_answer_text = student_answer_obj.answer_text
            status = student_answer_obj.status

        # Nəticə obyektini yaradırıq
        question_data = {
            'question_id': question.id,
            'question_text': question.text,
            'student_answer': student_answer_text,
            'correct_answer': question.correct_answer,
            'status': status,
            'video_start_time': question.video_start_time,
            'topic': question.topic,
            'difficulty': question.difficulty
        }
        
        # Fənnə görə qruplaşdırırıq
        subject_name = question.subject.name if question.subject else "Adsız Fənn"
        results_by_subject[subject_name].append(question_data)

    # Nəticələri sıralı şəkildə formatlayırıq
    final_ordered_results = []
    for subject_name, questions in results_by_subject.items():
        final_ordered_results.append({
            "subject_name": subject_name,
            "questions": questions
        })

    # Dəyişməz qalan hissə
    detailed_stats = calculate_detailed_score(submission)
    return jsonify({
        'exam_title': submission.exam.title,
        'exam_type': submission.exam.exam_type.name,
        'exam_class': submission.exam.class_name.name,
        'video_url': submission.exam.video_url,
        'submission_date': submission.submitted_at.strftime('%Y-%m-%d %H:%M'),
        'student_name': submission.user.name if submission.user else (submission.guest_name or "Qonaq"),
        'results': final_ordered_results,
        'stats': detailed_stats,
        'time_spent': submission.time_spent_per_question
    })



# app.py -> Köhnə get_organizers funksiyasını bununla tam əvəz edin

# app.py -> Faylın sonuna bu yeni route-ları əlavə edin

# İSTƏK 2: Admin Panelində Təşkilatçı və Əlaqələndirici məlumatları
# app.py -> Köhnə get_organizers_with_stats funksiyasını bununla əvəz edin

# app.py -> Köhnə get_organizers_with_stats funksiyasını bununla tam əvəz edin

@app.route('/api/admin/organizers_with_stats')
@login_required
def get_organizers_with_stats():
    if not isinstance(current_user, Admin): return jsonify({'message': 'Yetkiniz yoxdur'}), 403

    # Tələbə saylarını əvvəlcədən səmərəli şəkildə hesablamaq üçün alt-sorğular
    registered_subquery = db.session.query(
        User.organizer_id, func.count(User.id).label('registered_count')
    ).filter(User.organizer_id.isnot(None)).group_by(User.organizer_id).subquery()

    participated_subquery = db.session.query(
        User.organizer_id, func.count(func.distinct(User.id)).label('participated_count')
    ).join(Submission, User.id == Submission.user_id).filter(User.organizer_id.isnot(None)).group_by(User.organizer_id).subquery()

    organizers = db.session.query(
        Organizer, registered_subquery.c.registered_count, participated_subquery.c.participated_count
    ).outerjoin(registered_subquery, Organizer.id == registered_subquery.c.organizer_id)\
     .outerjoin(participated_subquery, Organizer.id == participated_subquery.c.organizer_id).all()

    result = [{
        'id': org.id, 'name': org.name, 'email': org.email, 'contact': org.contact,
        'bank_account': org.bank_account, 'commission_amount': org.commission_amount,
        'balance': org.balance, 'can_invite_affiliates': org.can_invite_affiliates,
        'is_approved': org.is_approved, 'affiliate_invite_limit': org.affiliate_invite_limit,
        'affiliate_commission': org.affiliate_commission,
        'registered_student_count': registered_count or 0,
        'participated_student_count': participated_count or 0
    } for org, registered_count, participated_count in organizers]

    return jsonify(result)



# İSTƏK 1: Admin və Kordinator tərəfindən komissiya tənzimlənməsi
@app.route('/api/admin/affiliate/<int:affiliate_id>/commission', methods=['POST'])
@login_required
def admin_set_affiliate_commission(affiliate_id):
    if not isinstance(current_user, Admin): return jsonify({'message': 'Yetkiniz yoxdur'}), 403
    
    affiliate = Affiliate.query.get_or_404(affiliate_id)
    data = request.get_json()
    new_rate = data.get('commission_rate')

    if new_rate is None: return jsonify({'message': 'Komissiya dəyəri göndərilməyib'}), 400
    
    affiliate.commission_rate = float(new_rate)
    db.session.commit()
    return jsonify({'message': f"'{affiliate.name}' üçün yeni komissiya {new_rate} AZN olaraq təyin edildi."})


@app.route('/api/organizer/affiliate/<int:affiliate_id>/commission', methods=['POST'])
@login_required
def organizer_set_affiliate_commission(affiliate_id):
    if not isinstance(current_user, Organizer): return jsonify({'message': 'Yetkiniz yoxdur'}), 403
    
    affiliate = Affiliate.query.filter_by(id=affiliate_id, parent_organizer_id=current_user.id).first_or_404()
    data = request.get_json()
    new_rate = data.get('commission_rate')

    if new_rate is None: return jsonify({'message': 'Komissiya dəyəri göndərilməyib'}), 400
    
    affiliate.commission_rate = float(new_rate)
    db.session.commit()
    return jsonify({'message': f"'{affiliate.name}' üçün yeni komissiya {new_rate} AZN olaraq təyin edildi."})





# app.py faylının sonuna əlavə edin

@app.route('/api/admin/teachers', methods=['GET'])
@login_required
def get_teachers():
    if not isinstance(current_user, Admin):
        return jsonify({'message': 'Yetkiniz yoxdur'}), 403
    
    teachers = Teacher.query.all()
    teacher_list = [{
        'id': teacher.id,
        'name': teacher.name,
        'email': teacher.email,
        'subject': teacher.subject.name
    } for teacher in teachers]
    return jsonify(teacher_list)


@app.route('/api/admin/teachers', methods=['POST'])
@login_required
def create_teacher():
    if not isinstance(current_user, Admin):
        return jsonify({'message': 'Yetkiniz yoxdur'}), 403
    
    data = request.get_json()
    if not data or 'email' not in data or 'password' not in data or 'name' not in data or 'subject_id' not in data:
        return jsonify({'message': 'Bütün məlumatlar (ad, email, şifrə, fənn) daxil edilməlidir'}), 400

    if Teacher.query.filter_by(email=data['email']).first():
        return jsonify({'message': 'Bu e-poçt ilə artıq bir müəllim mövcuddur'}), 409

    hashed_password = bcrypt.generate_password_hash(data['password']).decode('utf-8')
    new_teacher = Teacher(
        name=data['name'],
        email=data['email'],
        password=hashed_password,
        subject_id=data['subject_id']
    )
    db.session.add(new_teacher)
    db.session.commit()
    return jsonify({'message': f"{data['name']} adlı müəllim uğurla yaradıldı!"}), 201


@app.route('/api/admin/teachers/<int:teacher_id>', methods=['DELETE'])
@login_required
def delete_teacher(teacher_id):
    if not isinstance(current_user, Admin):
        return jsonify({'message': 'Yetkiniz yoxdur'}), 403
        
    teacher = Teacher.query.get_or_404(teacher_id)
    db.session.delete(teacher)
    db.session.commit()
    return jsonify({'message': 'Müəllim uğurla silindi!'})



# app.py faylının sonuna, digər route-ların yanına əlavə edin

@app.route('/api/admin/organizer/<int:org_id>/reset-balance', methods=['POST'])
@login_required
def reset_organizer_balance(org_id):
    """ Təşkilatçının balansını sıfırlayır """
    if not isinstance(current_user, Admin):
        return jsonify({'message': 'Yetkiniz yoxdur'}), 403

    organizer = Organizer.query.get_or_404(org_id)
    organizer.balance = 0.0
    db.session.commit()
    
    return jsonify({'message': f"'{organizer.name}' adlı təşkilatçının balansı uğurla sıfırlandı."})




@app.route('/api/admin/organizer/<int:org_id>/update', methods=['POST'])
@login_required
def update_organizer(org_id):
    if not isinstance(current_user, Admin):
        return jsonify({'message': 'Yetkiniz yoxdur'}), 403

    organizer = Organizer.query.get_or_404(org_id)
    data = request.get_json()

    # Yalnız komissiya məbləğini yeniləməyə icazə veririk
    if 'commission_amount' in data:
        organizer.commission_amount = float(data.get('commission_amount', organizer.commission_amount))

    db.session.commit()
    return jsonify({'message': f"'{organizer.name}' adlı təşkilatçının məlumatları uğurla yeniləndi."})












# app.py faylının sonuna əlavə edin

@app.route('/api/organizer/students')
@login_required
def get_organizer_students():
    # DÜZƏLİŞ BURADADIR
    if not (isinstance(current_user, Organizer) or isinstance(current_user, Affiliate)):
        return jsonify({'message': 'Yetkiniz yoxdur'}), 403
    
    # Hər iki istifadəçi növünün şagirdlərini gətirmək üçün
    if isinstance(current_user, Organizer):
        students = User.query.filter_by(organizer_id=current_user.id).all()
    else: # Deməli Affiliate-dir
        students = User.query.filter_by(affiliate_id=current_user.id).all()
    
    student_list = []
    for student in students:
        submissions = Submission.query.filter_by(user_id=student.id).order_by(Submission.submitted_at.desc()).all()
        submission_data = [{
            'exam_title': sub.exam.title,
            'score': sub.score,
            'date': sub.submitted_at.strftime('%Y-%m-%d %H:%M')
        } for sub in submissions]

        student_list.append({
            'id': student.id,
            'name': student.name,
            'school': student.school,
            'class': student.class_,
            'submissions': submission_data
        })
        
    return jsonify(student_list)

@app.route('/api/organizer/profile')
@login_required
def organizer_profile():
    # DÜZƏLİŞ BURADADIR
    if not (isinstance(current_user, Organizer) or isinstance(current_user, Affiliate)):
        return jsonify({'message': 'Yetkiniz yoxdur'}), 403

    # Təşkilatçının cəlb etdiyi əlaqələndiricilərin siyahısı
    affiliates_data = []
    # Yalnız Organizer-lər əlaqələndirici dəvət edə bildiyi üçün yoxlama əlavə edirik
    if isinstance(current_user, Organizer):
        for aff in current_user.affiliates:
            affiliates_data.append({
                "id": aff.id,
                "name": aff.name,
                "email": aff.email
            })

    # Ortak məlumatları qaytarırıq
    response_data = {
        'name': current_user.name,
        'contact': current_user.contact,
        'email': current_user.email,
        'balance': current_user.balance
    }

    # Hər istifadəçi növünə görə xüsusi məlumatları əlavə edirik
    if isinstance(current_user, Organizer):
        response_data.update({
            'bank_account': current_user.bank_account,
            'invite_code': current_user.invite_code,
            'can_invite_affiliates': current_user.can_invite_affiliates,
            'affiliate_invite_code': current_user.affiliate_invite_code,
            'affiliates': affiliates_data
        })
    elif isinstance(current_user, Affiliate):
         response_data.update({
            'bank_account': current_user.bank_account,
            'invite_code': current_user.student_invite_code # Affiliate üçün şagird dəvət kodu
        })

    return jsonify(response_data)


# FAYLIN ƏN SONUNA BU İKİ FUNKSİYANI ƏLAVƏ EDİN

@app.route('/api/teacher/pending-reviews', methods=['GET'])
@login_required
def get_pending_reviews():
    if not isinstance(current_user, Teacher):
        return jsonify({'message': 'Yetkiniz yoxdur'}), 403

    teacher_subject_id = current_user.subject_id

    pending_answers = Answer.query.join(Question).filter(
        Question.subject_id == teacher_subject_id,
        Answer.status == 'pending_review'
    ).options(
        db.joinedload(Answer.submission).joinedload(Submission.user),
        db.joinedload(Answer.submission).joinedload(Submission.exam).joinedload(Exam.exam_type),
        db.joinedload(Answer.question).joinedload(Question.situational_block)
    ).order_by(Answer.submission_id, Question.situational_block_id).all()

    submissions_dict = {}
    for answer in pending_answers:
        sub = answer.submission
        if sub.id not in submissions_dict:
            student_name = sub.user.name if sub.user else (sub.guest_name or "Qonaq")
            student_class = sub.user.class_ if sub.user else "N/A"
            submissions_dict[sub.id] = {
                'submission_id': sub.id,
                'student_name': student_name,
                'student_class': student_class,
                'exam_title': sub.exam.title,
                'submission_date': sub.submitted_at.strftime('%Y-%m-%d %H:%M'),
                'exam_type': sub.exam.exam_type.name,
                'items_to_grade': [] # Cavabları bu yeni siyahıya yığacağıq
            }
        
        # Situasiya suallarını qruplaşdırırıq
        if answer.question.situational_block_id:
            # Əgər bu situasiya bloku üçün artıq bir qrup yaratmışıqsa, tapırıq
            block_id = answer.question.situational_block_id
            existing_block = next((item for item in submissions_dict[sub.id]['items_to_grade'] if item.get('block_id') == block_id), None)
            
            if not existing_block:
                # Əgər qrup yoxdursa, yenisini yaradırıq
                new_block = {
                    "type": "situational",
                    "block_id": block_id,
                    "main_text": answer.question.situational_block.main_text,
                    "main_image_path": answer.question.situational_block.image_path,
                    "sub_answers": []
                }
                submissions_dict[sub.id]['items_to_grade'].append(new_block)
                existing_block = new_block
            
            # Alt-sualı və cavabını həmin qrupa əlavə edirik
            existing_block['sub_answers'].append({
                "answer_id": answer.id,
                "question_text": answer.question.text,
                "student_answer": answer.answer_text,
                "images": [img.image_path for img in answer.images] # <-- BU SƏTRİ ƏLAVƏ EDİN

            })
        else:
            # Əgər normal açıq sualdırsa, onu ayrıca əlavə edirik
            submissions_dict[sub.id]['items_to_grade'].append({
                "type": "open",
                "answer_id": answer.id,
                "question_text": answer.question.text,
                "student_answer": answer.answer_text
            })

    return jsonify(list(submissions_dict.values()))



@app.route('/api/teacher/grade-answer', methods=['POST'])
@login_required
def grade_answer():
    if not isinstance(current_user, Teacher):
        return jsonify({'message': 'Yetkiniz yoxdur'}), 403

    data = request.get_json()
    answer_id = data.get('answer_id')
    score = data.get('score')
    feedback = data.get('feedback') # Rəyi sorğudan götürürük

    answer = Answer.query.get_or_404(answer_id)

    if answer.question.subject_id != current_user.subject_id:
        return jsonify({'message': 'Bu cavabı yoxlamaq üçün icazəniz yoxdur'}), 403

    answer.score = float(score)
    answer.status = 'graded'
    answer.graded_by_teacher_id = current_user.id
    answer.teacher_feedback = feedback # Rəyi bazaya yazırıq

    db.session.commit()
    return jsonify({'message': 'Cavab uğurla qiymətləndirildi!'})



# app.py faylının sonuna əlavə edin

@app.route('/api/admin/change-password', methods=['POST'])
@login_required
def change_admin_password():
    if not isinstance(current_user, Admin):
        return jsonify({'message': 'Bu əməliyyat üçün yetkiniz yoxdur'}), 403

    data = request.get_json()
    current_password = data.get('current_password')
    new_password = data.get('new_password')
    confirm_password = data.get('confirm_password')

    if not all([current_password, new_password, confirm_password]):
        return jsonify({'message': 'Bütün sahələr doldurulmalıdır'}), 400

    if not bcrypt.check_password_hash(current_user.password, current_password):
        return jsonify({'message': 'Mövcud şifrə yanlışdır'}), 400
    
    if new_password != confirm_password:
        return jsonify({'message': 'Yeni şifrələr bir-biri ilə uyğun gəlmir'}), 400
    
    if len(new_password) < 8:
        return jsonify({'message': 'Yeni şifrə ən az 8 simvoldan ibarət olmalıdır'}), 400

    current_user.password = bcrypt.generate_password_hash(new_password).decode('utf-8')
    db.session.commit()

    return jsonify({'message': 'Şifrəniz uğurla dəyişdirildi!'})






@app.route('/uploads/<path:filename>')
def serve_upload(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)



# app.py faylının sonuna əlavə edin
@app.route('/api/teacher/grade-submission-bulk', methods=['POST'])
@login_required
def grade_submission_bulk():
    if not isinstance(current_user, Teacher):
        return jsonify({'message': 'Yetkiniz yoxdur'}), 403

    data = request.get_json()
    answers_to_grade = data.get('answers')

    if not isinstance(answers_to_grade, list):
        return jsonify({'message': 'Yanlış format: cavablar siyahı (array) olmalıdır'}), 400
    
    try:
        for answer_data in answers_to_grade:
            answer = Answer.query.get(answer_data.get('answer_id'))
            if answer and answer.question.subject_id == current_user.subject_id:
                answer.score = float(answer_data.get('score'))
                answer.feedback = answer_data.get('feedback')
                answer.status = 'graded'
                answer.graded_by_teacher_id = current_user.id
                # Statistikada istifadə üçün cavabın yoxlanma tarixini də əlavə edirik (Problem 2 üçün)
                answer.graded_at = datetime.utcnow()

        db.session.commit()
        return jsonify({'message': 'Bütün cavablar uğurla qiymətləndirildi!'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Xəta baş verdi: {str(e)}'}), 500
    
    
    
    # app.py faylının sonuna əlavə edin
from sqlalchemy import func

@app.route('/api/teacher/stats', methods=['GET'])
@login_required
def get_teacher_stats():
    if not isinstance(current_user, Teacher):
        return jsonify({'message': 'Yetkiniz yoxdur'}), 403

    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Bugün yoxlanılan cavabların sayı
    answers_today = db.session.query(func.count(Answer.id)).filter(
        Answer.graded_by_teacher_id == current_user.id,
        Answer.graded_at >= today_start
    ).scalar()

    # Bugün cavabları yoxlanılan unikal şagirdlərin sayı
    students_today = db.session.query(func.count(func.distinct(Submission.user_id))).join(
        Answer, Answer.submission_id == Submission.id
    ).filter(
        Answer.graded_by_teacher_id == current_user.id,
        Answer.graded_at >= today_start
    ).scalar()

    return jsonify({
        'answers_today': answers_today,
        'students_today': students_today
    })
    
    
    # app.py faylının sonuna əlavə edin

@app.route('/api/admin/exam-types', methods=['POST'])
@login_required
def add_exam_type():
    if not isinstance(current_user, Admin):
        return jsonify({'message': 'Yetkiniz yoxdur'}), 403
    data = request.get_json()
    name = data.get('name')
    if not name:
        return jsonify({'message': 'Ad daxil edilməyib'}), 400
    if ExamType.query.filter_by(name=name).first():
        return jsonify({'message': 'Bu imtahan növü artıq mövcuddur'}), 409
    
    new_exam_type = ExamType(name=name)
    db.session.add(new_exam_type)
    db.session.commit()
    return jsonify({'message': f"'{name}' növü uğurla əlavə edildi", 'id': new_exam_type.id, 'name': new_exam_type.name}), 201

@app.route('/api/admin/class-names', methods=['POST'])
@login_required
def add_class_name():
    if not isinstance(current_user, Admin):
        return jsonify({'message': 'Yetkiniz yoxdur'}), 403
    data = request.get_json()
    name = data.get('name')
    if not name:
        return jsonify({'message': 'Ad daxil edilməyib'}), 400
    if ClassName.query.filter_by(name=name).first():
        return jsonify({'message': 'Bu sinif artıq mövcuddur'}), 409
        
    new_class_name = ClassName(name=name)
    db.session.add(new_class_name)
    db.session.commit()
    return jsonify({'message': f"'{name}' sinifi uğurla əlavə edildi", 'id': new_class_name.id, 'name': new_class_name.name}), 201




# Bütün statik HTML səhifələrini və digər faylları göstərmək üçün
# Bu marşrut həm "127.0.0.1:5000/", həm də "127.0.0.1:5000/login.html" kimi sorğuları idarə edəcək
@app.route('/')
@app.route('/<path:path>')
def serve_static_files(path='index.html'):
    # Təhlükəsizlik üçün yoxlama
    if '..' in path or path.startswith('/'):
        return "Not Found", 404
    
    # Layihənin ana qovluğunu təyin edirik
    static_folder = os.path.abspath(os.path.dirname(__file__))
    
    # Faylın tam yolunu tapırıq
    file_path = os.path.join(static_folder, path)
    
    # Əgər belə bir fayl mövcuddursa və bu bir fayldırsa, onu brauzerə göndəririk
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return send_from_directory(static_folder, path)
    
    # Əks halda, 404 xətası qaytarırıq
    return "Not Found", 404



# app.py -> Köhnə get_leaderboard funksiyasını bununla tam əvəz edin
from sqlalchemy import extract


# --- ƏLAQƏLƏNDİRİCİ (AFFILIATE) SİSTEMİ ÜÇÜN YENİ FUNKSİYALAR ---

# app.py -> Köhnə affiliate_register funksiyasını bununla əvəz edin

@app.route('/api/affiliate/register', methods=['POST'])
def affiliate_register():
    data = request.get_json()
    invite_code = data.get('invite_code')
    
    parent_organizer = Organizer.query.filter_by(affiliate_invite_code=invite_code).first()
    
    if not parent_organizer:
        return jsonify({'message': 'Dəvət kodu yanlışdır'}), 404
        
    if not parent_organizer.can_invite_affiliates:
        return jsonify({'message': 'Bu təşkilatçının əlaqələndirici dəvət etmək icazəsi yoxdur'}), 403

    current_affiliate_count = len(parent_organizer.affiliates)
    if current_affiliate_count >= parent_organizer.affiliate_invite_limit:
        return jsonify({'message': 'Təşkilatçı dəvət limitinə çatıb'}), 403

    if Affiliate.query.filter_by(email=data['email']).first():
        return jsonify({'message': 'Bu e-poçt artıq qeydiyyatdan keçib'}), 409

    hashed_password = bcrypt.generate_password_hash(data['password']).decode('utf-8')
    
    student_invite_code = str(uuid.uuid4().hex)[:8]
    while Organizer.query.filter_by(invite_code=student_invite_code).first() or Affiliate.query.filter_by(student_invite_code=student_invite_code).first():
        student_invite_code = str(uuid.uuid4().hex)[:8]

    new_affiliate = Affiliate(
        name=data['name'],
        email=data['email'],
        contact=data.get('contact'), # YENİ ƏLAVƏ EDİLDİ
        password=hashed_password,
        student_invite_code=student_invite_code,
        parent_organizer_id=parent_organizer.id
    )
    db.session.add(new_affiliate)
    
    parent_organizer.balance += parent_organizer.affiliate_commission
    
    db.session.commit()
    
    return jsonify({'message': 'Siz uğurla əlaqələndirici kimi qeydiyyatdan keçdiniz!'}), 201
# Mövcud şagird qeydiyyatı funksiyasını yeniləmək lazımdır ki,
# həm təşkilatçının, həm də əlaqələndiricinin dəvət kodunu qəbul etsin.
# Bunun üçün köhnə /api/register funksiyasını aşağıdakı ilə əvəz edin.

# Köhnə register funksiyasını bununla əvəz edin
# app.py -> Köhnə /api/register funksiyasını bununla əvəz edin
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'message': 'Bu e-poçt artıq qeydiyyatdan keçib'}), 409

    hashed_password = bcrypt.generate_password_hash(data['password']).decode('utf-8')

    organizer_id = None
    affiliate_id = None
    commission = None 

    invite_code = data.get('invite_code')
    if invite_code:
        organizer = Organizer.query.filter_by(invite_code=invite_code).first()
        affiliate = Affiliate.query.filter_by(student_invite_code=invite_code).first()

        if organizer:
            organizer_id = organizer.id
            commission = organizer.commission_amount
        elif affiliate:
            affiliate_id = affiliate.id
            organizer_id = affiliate.parent_organizer_id
            commission = affiliate.commission_rate

    new_user = User(
        name=data['name'], 
        contact=data['contact'], 
        school=data['school'], 
        class_=data['class'], 
        department=data['department'], 
        language=data.get('foreign-language'),
        email=data['email'], 
        password=hashed_password, 
        organizer_id=organizer_id,
        affiliate_id=affiliate_id,
        registration_commission=commission 
    )
    db.session.add(new_user)
    db.session.commit()
    return jsonify({'message': 'Qeydiyyat uğurlu oldu!'}), 201


@app.route('/api/admin/organizer/<int:org_id>/affiliate-settings', methods=['POST'])
@login_required
def update_affiliate_settings(org_id):
    if not isinstance(current_user, Admin):
        return jsonify({'message': 'Yetkiniz yoxdur'}), 403

    organizer = Organizer.query.get_or_404(org_id)
    data = request.get_json()

    organizer.can_invite_affiliates = data.get('can_invite', False)
    organizer.affiliate_invite_limit = int(data.get('limit', 0))
    organizer.affiliate_commission = float(data.get('commission', 1.0))

    # Əgər icazə verilibsə və dəvət kodu yoxdursa, yeni kod yaradırıq
    if organizer.can_invite_affiliates and not organizer.affiliate_invite_code:
        new_code = str(uuid.uuid4().hex)[:10]
        while Organizer.query.filter_by(affiliate_invite_code=new_code).first():
            new_code = str(uuid.uuid4().hex)[:10]
        organizer.affiliate_invite_code = new_code

    db.session.commit()
    return jsonify({'message': 'Ayarlar uğurla yadda saxlanıldı!'})




@app.route('/api/admin/student/<int:user_id>/details')
@login_required
def get_student_details(user_id):
    if not isinstance(current_user, Admin):
        return jsonify({'message': 'Yetkiniz yoxdur'}), 403

    student = User.query.get_or_404(user_id)

    details = {
        "name": student.name,
        "email": student.email,
        "contact": student.contact,
        "school": student.school,
        "class": student.class_
    }
    return jsonify(details)



@app.route('/api/admin/submissions')
@login_required
def get_all_submissions():
    if not isinstance(current_user, Admin):
        return jsonify({'message': 'Yetkiniz yoxdur'}), 403

    try:
        exam_type_id = request.args.get('exam_type_id')
        class_name_id = request.args.get('class_name_id')

        query = db.session.query(
            Submission, User.name, Exam.title, ExamType.name, ClassName.name
        ).outerjoin(User, Submission.user_id == User.id)\
         .join(Exam, Submission.exam_id == Exam.id)\
         .join(ExamType, Exam.exam_type_id == ExamType.id)\
         .join(ClassName, Exam.class_name_id == ClassName.id)

        if exam_type_id:
            query = query.filter(Exam.exam_type_id == exam_type_id)
        if class_name_id:
            query = query.filter(Exam.class_name_id == class_name_id)

        all_submissions = query.order_by(Submission.score.desc()).all()

        registered_list = []
        guest_list = []

        for sub, user_name, exam_title, exam_type_name, class_name in all_submissions:
            submission_data = {
                'student_name': user_name or "N/A",
                'guest_name': sub.guest_name or "Qonaq",
                'exam_title': exam_title,
                'exam_type': exam_type_name,
                'class_name': class_name,
                'score': sub.score,
                'date': sub.submitted_at.strftime('%Y-%m-%d %H:%M')
            }
            if sub.user_id:
                registered_list.append(submission_data)
            else:
                guest_list.append(submission_data)

        return jsonify({'registered': registered_list, 'guest': guest_list})

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Nəticələri çəkərkən xəta baş verdi: {str(e)}"}), 500
    
    
    
    from sqlalchemy import func, extract
from datetime import datetime

# app.py faylının ən sonuna əlavə edin



from sqlalchemy import func

@app.route('/api/leaderboard')
def get_leaderboard():
    try:
        period = request.args.get('period', 'month')
        now = datetime.utcnow()

        query = db.session.query(
            User.name,
            func.sum(Submission.score).label('total_score')
        ).join(Submission, User.id == Submission.user_id)

        if period == 'month':
            query = query.filter(
                extract('year', Submission.submitted_at) == now.year,
                extract('month', Submission.submitted_at) == now.month
            )
        elif period == 'year':
            query = query.filter(
                extract('year', Submission.submitted_at) == now.year
            )

        leaderboard_data = query.group_by(User.id).order_by(func.sum(Submission.score).desc()).limit(10).all()

        leaderboard_list = [
            {"rank": i + 1, "name": name, "total_score": round(total_score if total_score else 0)}
            for i, (name, total_score) in enumerate(leaderboard_data)
        ]

        return jsonify(leaderboard_list)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Daxili server xətası: {str(e)}"}), 500
    
    
    
    # app.py -> Köhnə get_affiliates_with_stats və get_my_affiliates funksiyalarını silib
#           bu bütün bloku faylın sonuna əlavə edin.


@app.route('/api/organizer/affiliate/<int:affiliate_id>/reset-balance', methods=['POST'])
@login_required
def organizer_reset_affiliate_balance(affiliate_id):
    if not isinstance(current_user, Organizer):
        return jsonify({'message': 'Yetkiniz yoxdur'}), 403
    
    affiliate = Affiliate.query.filter_by(id=affiliate_id, parent_organizer_id=current_user.id).first_or_404()
    affiliate.balance = 0.0
    db.session.commit()
    return jsonify({'message': f"'{affiliate.name}' adlı əlaqələndiricinin balansı sıfırlandı."})

@app.route('/api/admin/affiliates_with_stats')
@login_required
def get_affiliates_with_stats():
    if not isinstance(current_user, Admin): return jsonify({'message': 'Yetkiniz yoxdur'}), 403

    registered_subquery = db.session.query(
        User.affiliate_id, func.count(User.id).label('registered_count')
    ).filter(User.affiliate_id.isnot(None)).group_by(User.affiliate_id).subquery()

    participated_subquery = db.session.query(
        User.affiliate_id, func.count(func.distinct(User.id)).label('participated_count')
    ).join(Submission, User.id == Submission.user_id).filter(User.affiliate_id.isnot(None)).group_by(User.affiliate_id).subquery()

    affiliates = db.session.query(
        Affiliate, Organizer.name.label('parent_name'), registered_subquery.c.registered_count, participated_subquery.c.participated_count
    ).join(Organizer, Affiliate.parent_organizer_id == Organizer.id)\
     .outerjoin(registered_subquery, Affiliate.id == registered_subquery.c.affiliate_id)\
     .outerjoin(participated_subquery, Affiliate.id == participated_subquery.c.affiliate_id).all()

    result = [{
        'id': aff.id, 'name': aff.name, 'email': aff.email, 'contact': aff.contact,
        'bank_account': aff.bank_account, 'parent_organizer_name': parent_name, 
        'commission_rate': aff.commission_rate, 'balance': aff.balance,
        'registered_student_count': registered_count or 0,
        'participated_student_count': participated_count or 0
    } for aff, parent_name, registered_count, participated_count in affiliates]

    return jsonify(result)

# app.py -> Köhnə get_my_affiliates funksiyasını silin və bu bloku faylın sonuna əlavə edin

@app.route('/api/admin/organizer/<int:org_id>/reset-balance', methods=['POST'])
@login_required
def admin_reset_organizer_balance(org_id):
    if not isinstance(current_user, Admin):
        return jsonify({'message': 'Yetkiniz yoxdur'}), 403
    organizer = Organizer.query.get_or_404(org_id)
    organizer.balance = 0.0
    db.session.commit()
    return jsonify({'message': f"'{organizer.name}' adlı kordinatorun balansı sıfırlandı."})

@app.route('/api/admin/affiliate/<int:affiliate_id>/reset-balance', methods=['POST'])
@login_required
def admin_reset_affiliate_balance(affiliate_id):
    if not isinstance(current_user, Admin):
        return jsonify({'message': 'Yetkiniz yoxdur'}), 403
    affiliate = Affiliate.query.get_or_404(affiliate_id)
    affiliate.balance = 0.0
    db.session.commit()
    return jsonify({'message': f"'{affiliate.name}' adlı əlaqələndiricinin balansı sıfırlandı."})

# app.py faylında
@app.route('/api/organizer/my-affiliates-details')
@login_required
def get_my_affiliates_details():
    # Əgər daxil olan istifadəçi Affiliate-dirsə, xəta vermirik, sadəcə boş cavab qaytarırıq.
    if isinstance(current_user, Affiliate):
        return jsonify([])

    # Əgər Organizer deyilsə (və Affiliate də deyilsə), o zaman icazə yoxdur.
    if not isinstance(current_user, Organizer): 
        return jsonify({'message': 'Yetkiniz yoxdur'}), 403
    
    # Qalan kod olduğu kimi qalır...
    affiliates_query = db.session.query(
        Affiliate,
        func.count(func.distinct(User.id)).label('registered_count'),
        func.count(func.distinct(Submission.user_id)).label('participated_count')
    ).filter(Affiliate.parent_organizer_id == current_user.id)\
     .outerjoin(User, Affiliate.id == User.affiliate_id)\
     .outerjoin(Submission, User.id == Submission.user_id)\
     .group_by(Affiliate.id).all()

    result = [{
        'id': aff.id, 'name': aff.name, 'email': aff.email, 'contact': aff.contact,
        'bank_account': aff.bank_account,
        'commission_rate': aff.commission_rate,
        'balance': aff.balance,
        'registered_student_count': registered_count,
        'participated_student_count': participated_count
    } for aff, registered_count, participated_count in affiliates_query]
    
    return jsonify(result)


@app.route('/api/admin/organizer/<int:org_id>/approve', methods=['POST'])
@login_required
def approve_organizer(org_id):
    if not isinstance(current_user, Admin):
        return jsonify({'message': 'Yetkiniz yoxdur'}), 403
    
    organizer = Organizer.query.get_or_404(org_id)
    organizer.is_approved = True
    db.session.commit()
    return jsonify({'message': f"'{organizer.name}' adlı kordinator təsdiqləndi."})



# app.py -> Faylın sonuna əlavə edin

@app.route('/api/admin/organizer/<int:org_id>', methods=['DELETE'])
@login_required
def delete_organizer(org_id):
    if not isinstance(current_user, Admin):
        return jsonify({'message': 'Yetkiniz yoxdur'}), 403
    
    organizer = Organizer.query.get_or_404(org_id)
    # Bu kordinatora bağlı olan tələbələrin əlaqəsini kəsirik
    User.query.filter_by(organizer_id=org_id).update({'organizer_id': None})
    db.session.delete(organizer)
    db.session.commit()
    return jsonify({'message': f"'{organizer.name}' adlı kordinator uğurla silindi."})

@app.route('/api/admin/affiliate/<int:affiliate_id>', methods=['DELETE'])
@login_required
def delete_affiliate(affiliate_id):
    if not isinstance(current_user, Admin):
        return jsonify({'message': 'Yetkiniz yoxdur'}), 403
    
    affiliate = Affiliate.query.get_or_404(affiliate_id)
    # Bu əlaqələndiriciyə bağlı olan tələbələrin əlaqəsini kəsirik
    User.query.filter_by(affiliate_id=affiliate_id).update({'affiliate_id': None})
    db.session.delete(affiliate)
    db.session.commit()
    return jsonify({'message': f"'{affiliate.name}' adlı əlaqələndirici uğurla silindi."})



# app.py -> Köhnə create_payment_order funksiyasını bununla əvəz edin

# app.py -> Köhnə create_payment_order funksiyasını bununla ƏVƏZ EDİN

# app.py faylına bu funksiyanı əlavə edin (köhnəsinin yerinə)

@app.route('/api/create-payment-order', methods=['POST'])
def create_payment_order():
    data = request.get_json()
    exam_id = data.get('examId')
    exam = Exam.query.get(exam_id)

    if not exam or exam.price <= 0:
        return jsonify({'error': 'İmtahan tapılmadı və ya ödəniş tələb olunmur'}), 404
        
    if not current_user.is_authenticated:
        if 'guest_session_id' not in session:
            session['guest_session_id'] = str(uuid.uuid4())
        session['guest_name'] = data.get('guestName')
        session['guest_email'] = data.get('guestEmail')

    merchant_id = os.environ.get('PAYRIFF_MERCHANT_ID')
    secret_key = os.environ.get('PAYRIFF_SECRET_KEY')

    if not merchant_id or not secret_key:
        return jsonify({'error': 'Serverdə Payriff ayarları konfiqurasiya edilməyib.'}), 500

    approve_url = url_for('payment_status_page', _external=True)
    cancel_url = url_for('payment_status_page', _external=True)
    decline_url = url_for('payment_status_page', _external=True)
    callback_url = url_for('payriff_webhook', _external=True)

    custom_order_id = str(uuid.uuid4())
    new_order = PaymentOrder(
        custom_order_id=custom_order_id,
        exam_id=exam.id,
        user_id=current_user.id if current_user.is_authenticated else None,
        guest_session_id=session.get('guest_session_id') if not current_user.is_authenticated else None,
        amount=exam.price,
        status='PENDING'
    )
    db.session.add(new_order)
    db.session.commit()
    
    payload = {
        "merchantId": merchant_id,              # <-- YENİ ƏLAVƏ EDİLƏN SƏTİR
        "amount": float(exam.price),
        "currency": "AZN",
        "description": f"'{exam.title}' imtahanı üçün ödəniş.",
        "callbackUrl": callback_url,
        "successRedirectUrl": success_redirect_url,
        "failedRedirectUrl": failed_redirect_url,
        "operation": "PURCHASE",
        "cardSave": False
    }
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': secret_key
    }
    
    payriff_url = f"https://api.payriff.com/api/v3/orders/{merchant_id}"

    try:
        response = requests.post(payriff_url, json=payload, headers=headers)
        response.raise_for_status()
        payment_data = response.json()

        if payment_data.get('status') == 'SUCCESS' and payment_data.get('payload'):
            payriff_order_id = payment_data['payload']['id']
            order_to_update = PaymentOrder.query.filter_by(custom_order_id=custom_order_id).first()
            if order_to_update:
                order_to_update.order_id_payriff = payriff_order_id
                db.session.commit()
            
            return jsonify({'paymentUrl': payment_data['payload']['payment']['url']})
        else:
            error_message = payment_data.get('message', 'Payriff tərəfindən naməlum xəta')
            print(f"!!! PAYRIFF LOGIC ERROR: {payment_data}")
            return jsonify({'error': error_message}), 500
            
    except Exception as e:
        error_details = str(e)
        if hasattr(e, 'response') and e.response is not None:
            error_details = e.response.text
        print(f"!!! PAYRIFF CRITICAL ERROR DETAILS: {error_details}")
        return jsonify({'error': f'Xəta baş verdi: {str(e)}'}), 500

class Announcement(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    text_content = db.Column(db.Text, nullable=True)
    file_path = db.Column(db.String(200), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

@app.route('/api/announcements', methods=['GET'])
def get_announcements():
    """Ana səhifə üçün elanları çəkir (ən son 5 elan)"""
    announcements = Announcement.query.order_by(Announcement.created_at.desc()).limit(5).all()
    result = [{
        'id': announcement.id,
        'title': announcement.title,
        'text_content': announcement.text_content,
        'file_path': announcement.file_path,
        'created_at': announcement.created_at.strftime('%d-%m-%Y %H:%M')
    } for announcement in announcements]
    return jsonify(result)

@app.route('/api/admin/announcements', methods=['GET', 'POST'])
@login_required
def manage_announcements():
    if not isinstance(current_user, Admin):
        return jsonify({'message': 'Yetkiniz yoxdur'}), 403

    if request.method == 'POST':
        title = request.form.get('title')
        text_content = request.form.get('text_content')
        file = request.files.get('file')

        if not title:
            return jsonify({'message': 'Başlıq daxil etmək məcburidir'}), 400

        file_path = None
        if file and file.filename != '':
            filename = secure_filename(file.filename)
            unique_filename = str(uuid.uuid4()) + "_" + filename
            file.save(os.path.join(app.config['UPLOAD_FOLDER'], unique_filename))
            file_path = unique_filename

        new_announcement = Announcement(
            title=title,
            text_content=text_content,
            file_path=file_path
        )
        db.session.add(new_announcement)
        db.session.commit()
        return jsonify({'message': 'Elan uğurla yaradıldı!'}), 201

    # GET request
    announcements = Announcement.query.order_by(Announcement.created_at.desc()).all()
    result = [{
        'id': announcement.id,
        'title': announcement.title,
        'created_at': announcement.created_at.strftime('%d-%m-%Y')
    } for announcement in announcements]
    return jsonify(result)

@app.route('/api/admin/announcements/<int:announcement_id>', methods=['DELETE'])
@login_required
def delete_announcement(announcement_id):
    if not isinstance(current_user, Admin):
        return jsonify({'message': 'Yetkiniz yoxdur'}), 403
    
    announcement = Announcement.query.get_or_404(announcement_id)
    if announcement.file_path:
        try:
            os.remove(os.path.join(app.config['UPLOAD_FOLDER'], announcement.file_path))
        except OSError as e:
            print(f"Error deleting file: {e.strerror}")

    db.session.delete(announcement)
    db.session.commit()
    return jsonify({'message': 'Elan uğurla silindi!'})



# app.py -> FAYLIN ƏN SONUNA ƏLAVƏ EDİN

@app.route('/test-webhook', methods=['POST'])
def test_webhook():
    print("!!!!!!!!!!!!!!! TEST WEBHOOK UĞURLA QƏBUL EDİLDİ !!!!!!!!!!!!!!!")
    return jsonify({"status": "ok", "message": "Test successful!"}), 200

@app.route('/api/check-payment-for-exam/<int:exam_id>')
def check_payment_for_exam(exam_id):
    has_access = False
    exam = Exam.query.get(exam_id)

    if not exam:
        return jsonify({"error": "İmtahan tapılmadı"}), 404

    if exam.price <= 0:
        has_access = True
    else:
        user_id = current_user.id if current_user.is_authenticated and isinstance(current_user, User) else None
        guest_session_id = session.get('guest_session_id')

        order = PaymentOrder.query.filter(
            (PaymentOrder.exam_id == exam_id) & (PaymentOrder.status == 'APPROVED') &
            ((PaymentOrder.user_id == user_id) if user_id else (PaymentOrder.guest_session_id == guest_session_id))
        ).first()

        if order:
            has_access = True
    
    if has_access:
        return jsonify({"status": "ok", "message": "Access granted"}), 200
    else:
        return jsonify({"status": "error", "message": "Access denied"}), 403