// admin-edit-exam.js faylının tam kodu

document.addEventListener('DOMContentLoaded', () => {
    // Bu kod bloku admin-dashboard.js-dən kopyalanıb, çünki eyni funksionallıq lazımdır
    // (Sual əlavə etmə, silmə, növünü dəyişmə və s.)
    
    // ... admin-dashboard.js faylının içindəki BÜTÜN "İMTAHAN YARAT BÖLMƏSİ" kodunu bura kopyalayın ...
    // Yəni, 'const createExamForm = ...' ilə başlayıb, ən sona qədər olan bütün imtahan yaratma məntiqi

    // --- YENİ KOD BAŞLAYIR ---

    const urlParams = new URLSearchParams(window.location.search);
    const examId = urlParams.get('examId');
    const formTitle = document.getElementById('exam-form-title');
    const submitButton = document.getElementById('exam-submit-btn');

    if (!examId) {
        alert("İmtahan ID-si tapılmadı!");
        window.location.href = 'admin-dashboard.html';
        return;
    }

    // Formanın başlığını və düyməsini dəyişirik
    formTitle.textContent = "İmtahanı Redaktə Et";
    submitButton.textContent = "Dəyişiklikləri Yadda Saxla";

    // 1. İmtahan məlumatlarını serverdən çəkirik
    fetch(`/api/admin/exam/${examId}`, { credentials: 'include' })
        .then(res => res.json())
        .then(examData => {
            // 2. Formanın əsas sahələrini doldururuq
            document.getElementById('exam-title').value = examData.title;
            document.getElementById('exam-type').value = examData.examTypeId;
            document.getElementById('class-name').value = examData.classNameId;
            document.getElementById('exam-duration').value = examData.duration;
            document.getElementById('exam-price').value = examData.price;

            // Fənnlərə aid video linklərini doldururuq
            if (examData.subject_videos) {
                for (const [subjectId, videoUrl] of Object.entries(examData.subject_videos)) {
                    const videoInput = document.getElementById(`subject-video-${subjectId}`);
                    if (videoInput) {
                        videoInput.value = videoUrl;
                    }
                }
            }

            // 3. Mövcud sualları ekrana dinamik olaraq çəkirik
            examData.questions.forEach(q_data => {
                addQuestionBtn.click(); // Yeni bir sual bloku yaradırıq
                const newQuestionBlock = document.getElementById(`question-block-${questionCounter}`);
                
                // Yaradılmış yeni blokun sahələrini məlumatlarla doldururuq
                newQuestionBlock.dataset.questionId = q_data.id; // Mövcud sualın ID-sini saxlayırıq
                newQuestionBlock.querySelector('.question-subject').value = q_data.subject_id;
                newQuestionBlock.querySelector('.question-type-select').value = q_data.question_type;
                
                // renderSpecificFields funksiyasını çağırırıq ki, düzgün növ üçün sahələr yaransın
                renderSpecificFields(q_data.question_type, questionCounter);

                // Sahələri doldurmağa davam edirik
                const editor = tinymce.get(`question-text-${questionCounter}`);
                if (editor) {
                    editor.on('init', () => editor.setContent(q_data.text || ''));
                } else {
                     newQuestionBlock.querySelector('.question-text').value = q_data.text || '';
                }

                newQuestionBlock.querySelector('.question-topic').value = q_data.topic || '';
                newQuestionBlock.querySelector('.question-difficulty').value = q_data.difficulty || 'asan';
                newQuestionBlock.querySelector('.question-points').value = q_data.points || 1;

                if (q_data.video_start_time) {
                    const minutes = Math.floor(q_data.video_start_time / 60);
                    const seconds = q_data.video_start_time % 60;
                    newQuestionBlock.querySelector('.time-input-minutes').value = minutes;
                    newQuestionBlock.querySelector('.time-input-seconds').value = seconds;
                }

                // Sual növünə görə xüsusi sahələri doldururuq
                if (q_data.question_type === 'closed' && q_data.options) {
                    q_data.options.forEach(opt => {
                        const optEditor = tinymce.get(`option-text-${questionCounter}-${opt.variant}`);
                         if (optEditor) {
                            optEditor.on('init', () => optEditor.setContent(opt.text || ''));
                        }
                    });
                    newQuestionBlock.querySelector('.correct-answer-closed').value = q_data.correct_answer;
                }
                // ... digər sual növləri (open, matching) üçün də oxşar doldurma məntiqi əlavə oluna bilər ...
            });
        });

    // 4. Formanı göndərmə (submit) məntiqini dəyişirik
    // Köhnə 'submit' hadisəsini ləğv edib, yenisini yazırıq
    createExamForm.addEventListener('submit', (e) => {
        e.preventDefault();
        // ... (İmtahan yaratma formasındakı məlumat toplama məntiqinin eynisi) ...
        // Ancaq fərqli olaraq, hər sual blokundan 'dataset.questionId'-ni də götürürük
        // və sonda məlumatları POST yerinə PUT metodu ilə `/api/admin/exam/${examId}` ünvanına göndəririk

        const examPayload = { /* ... məlumatları JSON obyekti kimi yığın ... */ };

        fetch(`/api/admin/exam/${examId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'credentials': 'include' },
            body: JSON.stringify(examPayload)
        })
        .then(res => res.json())
        .then(result => {
            alert(result.message);
            if (result.message.includes('uğurla')) {
                window.location.href = 'admin-dashboard.html';
            }
        });
    }, { once: true }); // 'once: true' köhnə listener-in təkrar işləməsinin qarşısını alır

});