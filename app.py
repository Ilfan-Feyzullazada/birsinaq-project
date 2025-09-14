# app.py - BÜTÜN DÜZƏLİŞLƏR EDİLMİŞ, TAM VƏ YEKUN KOD (QƏTİ VERSİYA)

import os
import uuid
import click
import json
from datetime import datetime
from collections import defaultdict

from flask import send_from_directory
from flask import Flask, request, jsonify, session
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from itsdangerous import URLSafeTimedSerializer, SignatureExpired
from flask_mail import Mail, Message
from sqlalchemy.dialects.sqlite import JSON as SQLJSON # Adların qarışmaması üçün JSON adını dəyişirik
from flask_migrate import Migrate
from werkzeug.utils import secure_filename

# --- Layihənin əsas qovluğunu təyin edirik ---
basedir = os.path.abspath(os.path.dirname(__file__))

# --- Tətbiqin Qurulması ---
app = Flask(__name__)
CORS(app, supports_credentials=True, origins=["http://127.0.0.1:5500", "http://127.0.0.1:5501"])

# --- Konfiqurasiya ---
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'bu-cox-gizli-bir-acardir-hec-kime-vermeyin')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'db.sqlite3')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['MAIL_SERVER'] = os.environ.get('MAIL_SERVER', 'localhost')
app.config['MAIL_PORT'] = int(os.environ.get('MAIL_PORT', 1025))
app.config['MAIL_USE_TLS'] = os.environ.get('MAIL_USE_TLS', 'false').lower() in ['true', 'on', '1']
app.config['MAIL_USE_SSL'] = os.environ.get('MAIL_USE_SSL', 'false').lower() in ['true', 'on', '1']
app.config['MAIL_DEFAULT_SENDER'] = os.environ.get('MAIL_DEFAULT_SENDER', 'noreply@birsinaq.az')
app.config['UPLOAD_FOLDER'] = os.path.join(basedir, 'uploads')
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

    # DÜZƏLİŞ: Buradakı əlaqə yeniləndi
    submissions = db.relationship('Submission', back_populates='user', cascade="all, delete-orphan")

    def get_id(self): return f"user-{self.id}"

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
    registered_students = db.relationship('User', backref='organizer', lazy=True)
    def get_id(self): return f"organizer-{self.id}"

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
    
    # YENİ ƏLAVƏ EDİLƏN SAHƏ
    graded_at = db.Column(db.DateTime, nullable=True)

    question = db.relationship('Question')
    graded_by = db.relationship('Teacher')
    submission = db.relationship('Submission', back_populates='individual_answers')
    
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
@login_manager.user_loader
def load_user(user_id_str):
    if not user_id_str or '-' not in user_id_str: return None
    user_type, user_id = user_id_str.split('-', 1)
    models = {'user': User, 'admin': Admin, 'teacher': Teacher, 'organizer': Organizer}
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
        login_user(admin, remember=True)
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

        # === DÜZƏLİŞ: `new_exam` obyekti funksiyanın əvvəlində yaradılır ===
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
        db.session.flush() # ID-ni əldə etmək üçün

        # === SUALLARIN EMALI PROSESİ (dəyişməz qalıb) ===
        for idx, q_data in enumerate(questions_data):
            # ... (sizin sual emalı kodunuz burada olduğu kimi qalır) ...
            q_type = q_data['question_type']
            
            question_image_filename = None
            question_image_key = f'question_image_{idx}'
            if question_image_key in files:
                file = files[question_image_key]
                if file and file.filename != '':
                    filename = secure_filename(file.filename)
                    unique_filename = str(uuid.uuid4()) + "_" + filename
                    file.save(os.path.join(app.config['UPLOAD_FOLDER'], unique_filename))
                    question_image_filename = unique_filename
            
            if q_type == 'closed':
                processed_options = []
                variants = ['A', 'B', 'C', 'D', 'E']
                for i, variant in enumerate(variants):
                    option_text = q_data['options'][i] if i < len(q_data['options']) else ""
                    option_image_filename = None
                    option_image_key = f'option_image_{idx}_{variant}'
                    if option_image_key in files:
                        file = files[option_image_key]
                        if file and file.filename != '':
                            filename = secure_filename(file.filename)
                            unique_filename = str(uuid.uuid4()) + "_" + filename
                            file.save(os.path.join(app.config['UPLOAD_FOLDER'], unique_filename))
                            option_image_filename = unique_filename
                    processed_options.append({
                        "variant": variant, "text": option_text, "image_path": option_image_filename
                    })
                q_data['options'] = processed_options
                q_data['correct_answer'] = q_data['correct_answer'][0] if q_data['correct_answer'] else None

            if q_type == 'situational':
                # ... (situasiya sualı məntiqi olduğu kimi qalır) ...
                situational_image_filename = None
                situational_image_key = f'image_{idx}'
                if situational_image_key in files:
                    file = files[situational_image_key]
                    if file and file.filename != '':
                        filename = secure_filename(file.filename)
                        unique_filename = str(uuid.uuid4()) + "_" + filename
                        file.save(os.path.join(app.config['UPLOAD_FOLDER'], unique_filename))
                        situational_image_filename = unique_filename
                new_block = SituationalQuestionBlock(exam_id=new_exam.id, main_text=q_data['text'], image_path=situational_image_filename)
                db.session.add(new_block)
                db.session.flush()
                for sub_question_text in q_data['sub_questions']:
                    sub_q = Question(exam_id=new_exam.id, subject_id=q_data['subject_id'], situational_block_id=new_block.id, question_type='situational_open', text=sub_question_text, video_start_time=convert_time_to_seconds(q_data.get('video_start_time')))
                    db.session.add(sub_q)
            else:
                new_question = Question(
                    exam_id=new_exam.id, 
                    subject_id=q_data['subject_id'], 
                    question_type=q_data['question_type'], 
                    text=q_data['text'], 
                    options=q_data['options'], 
                    correct_answer=q_data['correct_answer'],
                    video_start_time=convert_time_to_seconds(q_data.get('video_start_time')),
                    topic=q_data.get('topic'),
                    difficulty=q_data.get('difficulty'),
                    question_image_path=question_image_filename
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
        Submission.query.filter_by(exam_id=exam.id).delete()
        db.session.delete(exam)
        db.session.commit()
        return jsonify({'message': 'İmtahan və ona bağlı bütün nəticələr uğurla silindi!'})
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

# --- STUDENT & GENERAL API ---
@app.route('/api/profile')
@login_required
def profile():
    if not isinstance(current_user, User):
        return jsonify({'message': 'Yetkiniz yoxdur'}), 403
    submission_history = []
    for sub in sorted(current_user.submissions, key=lambda x: x.submitted_at, reverse=True):
        submission_history.append({
            'id': sub.id, 'exam_title': sub.exam.title, 'score': sub.score,
            'date': sub.submitted_at.strftime('%Y-%m-%d %H:%M')
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
        if not exam_type_name or not class_name_str: return jsonify({"error": "İmtahan növü və sinif tələb olunur"}), 400
        exam_type = ExamType.query.filter_by(name=exam_type_name).first()
        class_name_obj = ClassName.query.filter_by(name=class_name_str).first()
        if not exam_type or not class_name_obj: return jsonify([])
        exams = Exam.query.filter_by(is_active=True, exam_type_id=exam_type.id, class_name_id=class_name_obj.id).all()
        exam_list = [{'id': exam.id, 'title': exam.title, 'price': exam.price} for exam in exams]

        return jsonify(exam_list)
    except Exception as e:
        print(f"Error in /api/exams: {e}")
        return jsonify({"error": "Daxili server xətası"}), 500

@app.route('/api/exam-test/<int:exam_id>')
def get_exam_for_test(exam_id):
    try:
        exam = Exam.query.filter_by(id=exam_id, is_active=True).first_or_404("İmtahan tapılmadı və ya aktiv deyil.")
        normal_questions_data = []
        for q in exam.questions:
            if q.situational_block_id is None:
                subject_name = q.subject.name if q.subject else "Təyin edilməyib"
                normal_questions_data.append({
        'id': q.id, 
        'subject': subject_name, 
        'question_type': q.question_type, 
        'text': q.text, 
        'options': q.options,
        'question_image_path': q.question_image_path # BU SƏTRİ ƏLAVƏ EDİN
    })
        situational_blocks_data = []
        for block in exam.situational_blocks:
            sub_questions_data = [{'id': sub_q.id, 'text': sub_q.text} for sub_q in block.questions]
            block_subject = ""
            if block.questions and block.questions[0].subject:
                block_subject = block.questions[0].subject.name
            situational_blocks_data.append({'id': block.id, 'subject': block_subject, 'main_text': block.main_text, 'image_path': block.image_path, 'sub_questions': sub_questions_data})
        exam_data = {'id': exam.id, 'title': exam.name, 'duration': exam.duration_minutes, 'normal_questions': normal_questions_data, 'situational_blocks': situational_blocks_data}
        return jsonify(exam_data)
    except Exception as e:
        print(f"GET EXAM FOR TEST ERROR: {e}")
        return jsonify({"error": f"İmtahan məlumatlarını yükləmək mümkün olmadı. Server xətası: {str(e)}"}), 500

# YENİ SUBMIT_EXAM FUNKSİYASI
# app.py faylında bu funksiyanı tapıb aşağıdakı kodla tam əvəz edin

@app.route('/api/exam/submit', methods=['POST'])
def submit_exam():
    try:
        data = request.get_json()
        exam_id = data.get('examId')
        user_answers_dict = data.get('answers') or {}
        
        # === DƏYİŞİKLİK (1): Frontend-dən gələn zaman məlumatını alırıq ===
        time_spent = data.get('timeSpent') or {}

        exam = Exam.query.get(exam_id)
        if not exam:
            return jsonify({'error': 'İmtahan tapılmadı'}), 404

        new_submission = Submission(
            exam_id=exam_id, 
            score=0, 
            answers=user_answers_dict,
            # === DƏYİŞİKLİK (2): Məlumatı yeni submission obyektinə əlavə edirik ===
            time_spent_per_question=time_spent,
            guest_name=data.get('guestName'),
            guest_email=data.get('guestEmail')
        )

        is_guest = True
        if current_user.is_authenticated and isinstance(current_user, User):
            new_submission.user_id = current_user.id
            new_submission.guest_name = None
            new_submission.guest_email = None
            is_guest = False

            # Balans artırma məntiqi
            if current_user.organizer:
               current_user.organizer.balance += current_user.organizer.commission_amount

        elif not new_submission.guest_name or not new_submission.guest_email:
            return jsonify({'error': 'Qonaq kimi iştirak üçün ad və e-poçt daxil edilməlidir.'}), 400

        db.session.add(new_submission)
        db.session.flush()

        auto_graded_score = 0
        for question in exam.questions:
            user_answer = user_answers_dict.get(str(question.id))
            answer_to_save = json.dumps(user_answer) if isinstance(user_answer, list) else user_answer
            new_answer = Answer(submission_id=new_submission.id, question_id=question.id, answer_text=answer_to_save)

            if question.question_type in ['closed', 'multiple_choice', 'open']:
                correct_answer_str = json.dumps(sorted(question.correct_answer)) if isinstance(question.correct_answer, list) else str(question.correct_answer)
                user_answer_str = json.dumps(sorted(user_answer)) if isinstance(user_answer, list) else str(user_answer)

                if correct_answer_str == user_answer_str:
                    auto_graded_score += 1
                    new_answer.score = 1
                else:
                    new_answer.score = 0
                new_answer.status = 'graded'
            elif question.question_type == 'situational_open':
                new_answer.status = 'pending_review'
            else:
                new_answer.status = 'auto_graded'
                new_answer.score = 0
            db.session.add(new_answer)

        new_submission.score = auto_graded_score

        if is_guest:
            session['last_submission_id'] = new_submission.id

        db.session.commit()
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
        login_user(user, remember=True)

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

# YENİ REGISTER FUNKSİYASI
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'message': 'Bu e-poçt artıq qeydiyyatdan keçib'}), 409

    hashed_password = bcrypt.generate_password_hash(data['password']).decode('utf-8')

    # Dəvət koduna görə təşkilatçını tapırıq
    organizer = None
    if data.get('invite_code'):
        organizer = Organizer.query.filter_by(invite_code=data.get('invite_code')).first()

    new_user = User(
        name=data['name'], 
        contact=data['contact'], 
        school=data['school'], 
        class_=data['class'], 
        department=data['department'], 
        language=data.get('foreign-language'),
        email=data['email'], 
        password=hashed_password, 
        organizer_id=organizer.id if organizer else None # Şagirdi təşkilatçıya bağlayırıq
    )
    db.session.add(new_user)
    db.session.flush() # Yeni istifadəçinin ID-sini əldə etmək üçün

    # Qonaq imtahanlarını yeni hesaba bağlayırıq
    guest_submissions = Submission.query.filter_by(guest_email=new_user.email).all()
    for sub in guest_submissions:
        sub.user_id = new_user.id
        sub.guest_name = None # Artıq qonaq deyil
        sub.guest_email = None
        # Əgər şagirdin təşkilatçısı varsa, onun qonaq imtahanları üçün də balans artır
        if new_user.organizer: # Düzəliş: new_user.organizer olmalıdır
            new_user.organizer.balance += 2.0

    db.session.commit()
    return jsonify({'message': 'Qeydiyyat uğurlu oldu!'}), 201


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
        login_user(teacher, remember=True)
        return jsonify({'message': 'Müəllim girişi uğurludur!'})
    return jsonify({'message': 'E-poçt və ya şifrə yanlışdır'}), 401

# --- ORGANIZER API ---
@app.route('/api/organizer/register', methods=['POST'])
def organizer_register():
    data = request.get_json()
    if Organizer.query.filter_by(email=data['email']).first(): return jsonify({'message': 'Bu e-poçt artıq qeydiyyatdan keçib'}), 409
    hashed_password = bcrypt.generate_password_hash(data['password']).decode('utf-8')
    unique_code = str(uuid.uuid4().hex)[:8]
    while Organizer.query.filter_by(invite_code=unique_code).first(): unique_code = str(uuid.uuid4().hex)[:8]
    new_organizer = Organizer(name=data['name'], contact=data['contact'], bank_account=data['bank-account'], email=data['email'], password=hashed_password, invite_code=unique_code)
    db.session.add(new_organizer)
    db.session.commit()
    return jsonify({'message': 'Qeydiyyat uğurlu oldu!'}), 201

@app.route('/api/organizer/login', methods=['POST'])
def organizer_login():
    data = request.get_json()
    organizer = Organizer.query.filter_by(email=data['email']).first()
    if organizer and bcrypt.check_password_hash(organizer.password, data['password']):
        login_user(organizer, remember=True)
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

def calculate_detailed_score(submission):
    exam = submission.exam
    exam_type = exam.exam_type.name
    all_answers = submission.individual_answers

    subject_stats = defaultdict(lambda: {
        'correct': 0, 'incorrect': 0, 'unanswered': 0, 'score': 0,
        'correct_closed': 0, 'incorrect_closed': 0, 'written_score_sum': 0
    })
    
    total_question_count = len(exam.questions)

    for question in exam.questions:
        if not question.subject:
            total_question_count -= 1
            continue
        
        subject_name = question.subject.name
        s_stats = subject_stats[subject_name]
        
        answer_obj = next((a for a in all_answers if a.question_id == question.id), None)

        if not answer_obj or not answer_obj.answer_text or answer_obj.answer_text == '[]' or answer_obj.answer_text == '""':
            s_stats['unanswered'] += 1
            continue

        if answer_obj.status == 'graded' and answer_obj.score is not None:
            if answer_obj.score > 0:
                s_stats['correct'] += 1
                if question.question_type == 'closed':
                    s_stats['correct_closed'] += 1
                elif question.question_type == 'situational_open':
                    s_stats['written_score_sum'] += answer_obj.score # Müəllimin verdiyi balı toplayırıq
            else:
                s_stats['incorrect'] += 1
                if question.question_type == 'closed':
                    s_stats['incorrect_closed'] += 1
    
    final_score = 0
    
    # İmtahan növünə ("Buraxılış", "Blok") görə fərqli hesablama aparılır
    if exam_type in ["Buraxılış", "Blok"]:
        total_exam_score = 0
        for subject_name, s_stats in subject_stats.items():
            net_correct_closed = s_stats['correct_closed'] - (s_stats['incorrect_closed'] / 4.0)
            if net_correct_closed < 0: net_correct_closed = 0
            
            # Açıq tipli (kodlaşdırma) sualların düzgün cavabları
            other_correct = s_stats['correct'] - s_stats['correct_closed']
            
            # Fənn üzrə xam bal = (Qapalı sualların xalis sayı) + (Digər düzlər) + (Müəllimin verdiyi balların cəmi)
            subject_raw_score = net_correct_closed + other_correct + s_stats['written_score_sum']
            s_stats['score'] = round(subject_raw_score, 2)
            total_exam_score += subject_raw_score
            
        # Yekun bal sual sayına görə 300/400 bala uyğunlaşdırılır (scaling)
        max_possible_raw_score = total_question_count
        if max_possible_raw_score > 0:
            scale_factor = 1
            if exam_type == "Buraxılış":
                scale_factor = 300 / max_possible_raw_score
            elif exam_type == "Blok":
                scale_factor = 400 / max_possible_raw_score
            final_score = round(total_exam_score * scale_factor)

    elif exam_type == "İbtidai Sinif":
        correct_total = sum(s['correct'] for s in subject_stats.values())
        if total_question_count > 0:
            final_score = round((correct_total / total_question_count) * 700)
    
    else:
        final_score = sum(s['correct'] for s in subject_stats.values())

    return {
        'total_questions': total_question_count,
        'correct_count': sum(s['correct'] for s in subject_stats.values()),
        'incorrect_count': sum(s['incorrect'] for s in subject_stats.values()),
        'unanswered_count': sum(s['unanswered'] for s in subject_stats.values()),
        'final_score': final_score,
        'subjects': subject_stats
    }
    
    
# app.py

@app.route('/api/submission/<int:submission_id>/result')
def get_submission_result(submission_id):
    # Bu funksiyanın yuxarı hissəsi olduğu kimi qalır...
    submission = Submission.query.get_or_404(submission_id)
    can_view = False
    if current_user.is_authenticated and isinstance(current_user, User) and submission.user_id == current_user.id:
        can_view = True
    elif 'last_submission_id' in session and session['last_submission_id'] == submission_id:
        can_view = True
    if not can_view:
        # app.py -> get_submission_result funksiyası

    # ... funksiyanın əvvəli olduğu kimi qalır ...
            
     return jsonify({
        'exam_title': submission.exam.title,
        'exam_type': submission.exam.exam_type.name,    # YENİ SƏTİR
        'exam_class': submission.exam.class_name.name,  # YENİ SƏTİR
        'video_url': submission.exam.video_url,
        'submission_date': submission.submitted_at.strftime('%Y-%m-%d %H:%M'),
        'student_name': submission.user.name if submission.user else (submission.guest_name or "Qonaq"),
        'results': final_ordered_results,
        'stats': detailed_stats,
        'time_spent': submission.time_spent_per_question
    })

    detailed_stats = calculate_detailed_score(submission)
    
    valid_answers = [a for a in submission.individual_answers if a.question is not None]
    sorted_answers = sorted(valid_answers, key=lambda a: a.question.id)
    
    grouped_by_subject = {}
    for answer in sorted_answers:
        subject_name = answer.question.subject.name
        if subject_name not in grouped_by_subject: 
            grouped_by_subject[subject_name] = []
        
        grouped_by_subject[subject_name].append({
            'question_id': answer.question.id,
            'question_text': answer.question.text,
            'student_answer': answer.answer_text,
            'correct_answer': answer.question.correct_answer,
            'status': answer.status,
            'video_start_time': answer.question.video_start_time, # Bu məlumat artıq göndərilir
            'topic': answer.question.topic # YENİ: Mövzunu əlavə edirik
        })

    # Fənləri imtahandakı ardıcıllıqla sıralamaq üçün
    exam_questions_sorted = sorted(submission.exam.questions, key=lambda q: q.id)
    ordered_subject_names = []
    for q in exam_questions_sorted:
        if q.subject and q.subject.name not in ordered_subject_names: 
            ordered_subject_names.append(q.subject.name)
            
    final_ordered_results = []
    for subject_name in ordered_subject_names:
        if subject_name in grouped_by_subject:
            final_ordered_results.append({ "subject_name": subject_name, "questions": grouped_by_subject[subject_name] })
            
    return jsonify({
        'exam_title': submission.exam.title,
        'video_url': submission.exam.video_url, # Bu məlumat artıq göndərilir
        'submission_date': submission.submitted_at.strftime('%Y-%m-%d %H:%M'),
        'student_name': submission.user.name if submission.user else (submission.guest_name or "Qonaq"),
        'results': final_ordered_results,
        'stats': detailed_stats,
        'time_spent': submission.time_spent_per_question # YENİ: Sərf olunan vaxtı əlavə edirik
    })
    
# app.py faylının sonuna əlavə edin



@app.route('/api/admin/organizers', methods=['GET'])
@login_required
def get_organizers():
    """ Bütün təşkilatçıların siyahısını admin üçün qaytarır """
    if not isinstance(current_user, Admin):
        return jsonify({'message': 'Yetkiniz yoxdur'}), 403

    organizers = Organizer.query.order_by(Organizer.id.desc()).all()
    
    organizer_list = []
    for org in organizers:
        organizer_list.append({
            'id': org.id,
            'name': org.name,
            'email': org.email,
            'contact': org.contact,
            'bank_account': org.bank_account,
            'balance': org.balance,
            'commission_amount': org.commission_amount
        })
        
    return jsonify(organizer_list)









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
    """ Admin tərəfindən təşkilatçı məlumatlarını yeniləyir """
    if not isinstance(current_user, Admin):
        return jsonify({'message': 'Yetkiniz yoxdur'}), 403

    organizer = Organizer.query.get_or_404(org_id)
    data = request.get_json()

    if 'email' in data and data['email'] != organizer.email:
        if Organizer.query.filter_by(email=data['email']).first():
            return jsonify({'message': 'Bu e-poçt artıq istifadə olunur'}), 409

    organizer.name = data.get('name', organizer.name)
    organizer.email = data.get('email', organizer.email)
    organizer.contact = data.get('contact', organizer.contact)
    organizer.bank_account = data.get('bank_account', organizer.bank_account)
    organizer.commission_amount = float(data.get('commission_amount', organizer.commission_amount))

    db.session.commit()
    return jsonify({'message': f"'{organizer.name}' adlı təşkilatçının məlumatları uğurla yeniləndi."})















# app.py faylının sonuna əlavə edin

@app.route('/api/organizer/students')
@login_required
def get_organizer_students():
    if not isinstance(current_user, Organizer):
        return jsonify({'message': 'Yetkiniz yoxdur'}), 403
    
    students = User.query.filter_by(organizer_id=current_user.id).all()
    
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
    if not isinstance(current_user, Organizer):
        return jsonify({'message': 'Yetkiniz yoxdur'}), 403
    
    return jsonify({
        'name': current_user.name,
        'contact': current_user.contact,
        'bank_account': current_user.bank_account,
        'email': current_user.email,
        'invite_code': current_user.invite_code,
        'balance': current_user.balance # Balansı da əlavə edirik
    })
    
    
    
    
    # app.py faylının sonuna əlavə edin




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
                "student_answer": answer.answer_text
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