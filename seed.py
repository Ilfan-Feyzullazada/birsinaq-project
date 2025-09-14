# seed.py

from app import app, db, ExamType, ClassName, Subject

def seed_database():
    """
    Verilənlər bazasını imtahan növləri, siniflər və fənlər
    kimi ilkin məlumatlarla doldurur.
    """
    with app.app_context():
        try:
            print("İlkin məlumatlar bazaya əlavə edilir...")

            exam_types = ["Buraxılış", "Blok", "Liseylərə Hazırlıq", "İbtidai Sinif", "MİQ"]
            for type_name in exam_types:
                if not ExamType.query.filter_by(name=type_name).first():
                    db.session.add(ExamType(name=type_name))

            class_names = ["11-ci Sinif", "10-cu Sinif", "9-cu Sinif", "8-ci Sinif", "7-ci Sinif", "6-cı Sinif", "5-ci Sinif"]
            for class_name in class_names:
                if not ClassName.query.filter_by(name=class_name).first():
                    db.session.add(ClassName(name=class_name))
            
            subjects = ["Azərbaycan Dili", "Ədəbiyyat", "Riyaziyyat", "Fizika", "Kimya", "Biologiya", "Tarix", "Coğrafiya", "İngilis Dili"]
            for subject_name in subjects:
                if not Subject.query.filter_by(name=subject_name).first():
                    db.session.add(Subject(name=subject_name))
            
            db.session.commit()
            print("✅ Verilənlər bazası ilkin məlumatlarla uğurla dolduruldu.")
        
        except Exception as e:
            db.session.rollback()
            print(f"❌ Baza doldurularkən xəta baş verdi: {e}")

if __name__ == '__main__':
    seed_database()