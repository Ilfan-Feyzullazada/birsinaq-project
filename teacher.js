// teacher.js faylının bütün məzmununu bununla əvəz edin

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('pending-reviews-container');
    const statsContainer = document.getElementById('teacher-stats-container'); // Statistika üçün

    // Günlük statistikanı yükləyən funksiya
    function loadTeacherStats() {
        if (!statsContainer) return;

        fetch('/api/teacher/stats', { credentials: 'include' })
            .then(res => res.json())
            .then(stats => {
                statsContainer.innerHTML = `
                    <div class="stat-card">
                        <i class="fas fa-check-double"></i>
                        <div>
                            <h4>Bugün Yoxlanılan Cavab Sayı</h4>
                            <p>${stats.answers_today || 0}</p>
                        </div>
                    </div>
                    <div class="stat-card">
                        <i class="fas fa-user-graduate"></i>
                        <div>
                            <h4>Bugün Yoxlanılan Şagird Sayı</h4>
                            <p>${stats.students_today || 0}</p>
                        </div>
                    </div>
                `;
            }).catch(err => console.error("Statistika yüklənərkən xəta:", err));
    }

    // Yoxlanılacaq cavabları yükləyən funksiya
    function loadPendingReviews() {
        fetch('/api/teacher/pending-reviews', { credentials: 'include' })
            .then(res => {
                if (!res.ok) {
                    if (res.status === 401) window.location.href = 'teacher-login.html';
                    throw new Error('Server cavab vermir');
                }
                return res.json();
            })
            .then(submissions => {
                container.innerHTML = '';
                if (submissions.length === 0) {
                    container.innerHTML = '<p class="no-reviews-message">Sizin fənninizə uyğun yoxlanılacaq yeni cavab yoxdur.</p>';
                    return;
                }

                submissions.forEach(sub => {
                    const submissionGroup = document.createElement('div');
                    submissionGroup.className = 'submission-group';
                    submissionGroup.id = `submission-group-${sub.submission_id}`;

                    let itemsHTML = '';
                    sub.items_to_grade.forEach(item => {
                        let scoreOptions = getScoreOptions(sub.exam_type);

                        if (item.type === 'situational') {
                            let subAnswersHTML = '';
                            item.sub_answers.forEach(ans => {
                                // HƏR SUAL ÜÇÜN OLAN "TƏSDİQLƏ" DÜYMƏSİ BURADAN SİLİNİR
                                subAnswersHTML += `
                                <div class="sub-answer-block" data-answer-id="${ans.answer_id}">
                                    <p class="question-text">${ans.question_text}</p>
                                    <div class="student-answer">${ans.student_answer || "Cavab verilməyib"}</div>
                                    <div class="grading-form">
                                         <div class="form-group">
                                            <label for="score-${ans.answer_id}">Bal:</label>
                                            <select class="score-select" id="score-${ans.answer_id}">${scoreOptions}</select>
                                        </div>
                                        <div class="form-group">
                                            <label for="feedback-${ans.answer_id}">Rəy:</label>
                                            <textarea id="feedback-${ans.answer_id}" class="feedback-textarea" placeholder="Bu cavaba rəy bildirin..."></textarea>
                                        </div>
                                    </div>
                                </div>`;
                            });

                            itemsHTML += `
                            <div class="answer-item situational-wrapper">
                                <div class="main-question-text"><strong>Situasiya:</strong> ${item.main_text}</div>
                                ${item.main_image_path ? `<img src="/uploads/${item.main_image_path}" class="main-question-image" alt="Situasiya şəkli">` : ''}
                                <hr>
                                ${subAnswersHTML}
                            </div>`;
                        }
                    });

                    // BÜTÜN CAVABLARDAN SONRA ÜMUMİ DÜYMƏ ƏLAVƏ EDİLİR
                    submissionGroup.innerHTML = `
                    <div class="submission-header" data-target="submission-body-${sub.submission_id}">
                        <div class="student-info">
                            <span class="student-name">${sub.student_name}</span>
                            <span class="student-class">${sub.student_class}</span>
                        </div>
                        <div class="exam-info">
                            <span class="exam-title">${sub.exam_title}</span>
                            <span class="submission-date">${sub.submission_date}</span>
                        </div>
                        <i class="fas fa-chevron-down"></i>
                    </div>
                    <div class="submission-body hidden" id="submission-body-${sub.submission_id}">
                        ${itemsHTML}
                        <div class="submission-footer">
                           <button class="submit-all-grades-btn" data-submission-id="${sub.submission_id}">Bütün Cavabları Təsdiqlə</button>
                        </div>
                    </div>
                `;
                    container.appendChild(submissionGroup);
                });
            });
    }

    function getScoreOptions(examType) {
        // Bu funksiya dəyişməz qalır
        if (examType === 'Buraxılış') {
            return `<option value="0">0</option><option value="${1 / 3}">1/3</option><option value="${1 / 2}">1/2</option><option value="${2 / 3}">2/3</option><option value="1">1</option>`;
        } else if (examType === 'Blok') {
            return `<option value="0">0</option><option value="${1 / 2}">1/2</option><option value="1">1</option>`;
        }
        return `<option value="0">0</option><option value="1">1</option>`;
    }

    container.addEventListener('click', (e) => {
        // Akkordeon məntiqi
        const header = e.target.closest('.submission-header');
        if (header) {
            const body = document.getElementById(header.dataset.target);
            const icon = header.querySelector('i');
            body.classList.toggle('hidden');
            icon.classList.toggle('rotated');
            return;
        }

        // YENİ ÜMUMİ TƏSDİQLƏMƏ MƏNTİQİ
        if (e.target.classList.contains('submit-all-grades-btn')) {
            const btn = e.target;
            const submissionId = btn.dataset.submissionId;
            const submissionBody = document.getElementById(`submission-body-${submissionId}`);
            const answerBlocks = submissionBody.querySelectorAll('.sub-answer-block');
            
            const answersToGrade = [];
            answerBlocks.forEach(block => {
                const answerId = block.dataset.answerId;
                const score = document.getElementById(`score-${answerId}`).value;
                const feedback = document.getElementById(`feedback-${answerId}`).value;
                answersToGrade.push({ answer_id: answerId, score: score, feedback: feedback });
            });

            btn.textContent = 'Yoxlanılır...';
            btn.disabled = true;

            fetch('/api/teacher/grade-submission-bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ answers: answersToGrade })
            })
            .then(res => res.json())
            .then(result => {
                if (result.message.includes('uğurla')) {
                    // Uğurlu olarsa, həmin şagirdin bütün blokunu səhifədən silirik
                    const submissionGroup = document.getElementById(`submission-group-${submissionId}`);
                    submissionGroup.style.transition = 'opacity 0.5s ease';
                    submissionGroup.style.opacity = '0';
                    setTimeout(() => {
                        submissionGroup.remove();
                        // Statistikanı yeniləyirik
                        loadTeacherStats();
                        // Əgər başqa yoxlanılacaq cavab qalmayıbsa, mesaj göstəririk
                        if (container.children.length === 0) {
                            container.innerHTML = '<p class="no-reviews-message">Bütün cavablar yoxlanıldı. Təşəkkürlər!</p>';
                        }
                    }, 500);
                } else {
                    alert(result.message);
                    btn.textContent = 'Bütün Cavabları Təsdiqlə';
                    btn.disabled = false;
                }
            });
        }
    });

    // Səhifə yüklənəndə hər iki funksiyanı çağırırıq
    loadPendingReviews();
    loadTeacherStats();
});