document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTLƏRİN TƏYİN EDİLMƏSİ ---

    // exam-test.js-in yuxarısına
    const questionTimings = {}; // Hər sualın vaxtını burada saxlayacağıq
    let currentQuestionId = null;
    let questionStartTime = null;
    const urlParams = new URLSearchParams(window.location.search);
    const examId = urlParams.get('examId');
    const examTitleEl = document.getElementById('exam-title');
    const studentNameEl = document.getElementById('student-name');
    const timerDisplay = document.getElementById('time');
    const questionsBlock = document.getElementById('questions-block');
    const questionNumbersContainer = document.getElementById('question-numbers');
    const subjectNavContainer = document.querySelector('.subject-nav');
    const finishExamBtn = document.getElementById('finish-exam-btn');

    // --- PROFİL ADINI YÜKLƏMƏ ---
    fetch(`http://127.0.0.1:5000/api/profile`, { credentials: 'include' })
        .then(res => {
            if (res.ok) {
                return res.json();
            }
            return Promise.reject('Not logged in');
        })
        .then(profileData => {
            if (studentNameEl) studentNameEl.innerText = profileData.name;
        })
        .catch(() => {
            const studentNameFromUrl = urlParams.get('studentName');
            if (studentNameEl) studentNameEl.innerText = studentNameFromUrl || "Qonaq";
        });

    // --- İMTAHAN MƏLUMATLARINI SERVERDƏN ÇƏKMƏ ---
    if (!examId) {
        if (questionsBlock) {
            questionsBlock.innerHTML = '<h2 style="color: red; text-align: center;">İmtahan ID-si tapılmadı! Zəhmət olmasa, imtahan siyahısından yenidən seçin.</h2>';
        }
        return;
    }

    fetch(`http://127.0.0.1:5000/api/exam-test/${examId}`)
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw new Error(err.error || 'Server xətası') });
            }
            return response.json();
        })
        .then(data => {
            if (examTitleEl) examTitleEl.textContent = data.title;
            startTimer(data.duration);
            renderExam(data);
        })
        .catch(error => {
            if (questionsBlock) {
                questionsBlock.innerHTML = `<h2>Xəta: ${error.message}</h2>`;
            }
        });

    // --- SUALLARI VƏ NAVİQASİYANİ SƏHİFƏYƏ ÇƏKƏN FUNKSİYA ---
    function renderExam(data) {
        if (!questionsBlock || !questionNumbersContainer || !subjectNavContainer) return;
        questionsBlock.innerHTML = '';
        questionNumbersContainer.innerHTML = '';
        subjectNavContainer.innerHTML = '';

        const allItems = [];
        if (data.normal_questions) { data.normal_questions.forEach(q => allItems.push({ ...q, isSituational: false })); }
        if (data.situational_blocks) { data.situational_blocks.forEach(block => allItems.push({ ...block, isSituational: true })); }

        const questionsBySubject = allItems.reduce((acc, item) => {
            const subject = item.subject || 'Adsız Fənn';
            if (!acc[subject]) { acc[subject] = []; }
            acc[subject].push(item);
            return acc;
        }, {});

        let overallQuestionCounter = 0;

        for (const subject in questionsBySubject) {
            const btn = document.createElement('button');
            btn.className = 'subject-btn';
            btn.dataset.subject = subject;
            btn.textContent = subject;
            btn.onclick = () => {
                document.querySelectorAll('.subject-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(`subject-header-${subject.replace(/\s+/g, '-')}`).scrollIntoView({ behavior: 'smooth' });
            };
            subjectNavContainer.appendChild(btn);
            if (subjectNavContainer.children.length === 1) {
                btn.classList.add('active');
            }
        }

        for (const subject in questionsBySubject) {
            const subjectHeader = document.createElement('h2');
            subjectHeader.className = 'subject-header';
            subjectHeader.textContent = subject;
            subjectHeader.id = `subject-header-${subject.replace(/\s+/g, '-')}`;
            questionsBlock.appendChild(subjectHeader);

            questionsBySubject[subject].forEach(item => {
                overallQuestionCounter++;
                const questionWrapper = document.createElement('div');
                questionWrapper.id = `question-${overallQuestionCounter}`;
                questionWrapper.dataset.questionId = item.id;
                questionWrapper.className = 'question-wrapper';

                if (item.isSituational) {
                    let subQuestionsHTML = '';
                    if (item.sub_questions) {
                        item.sub_questions.forEach(sub_q => {
                            subQuestionsHTML += `
                            <div class="sub-question">
                                <p>${sub_q.text}</p>
                                <textarea name="q${sub_q.id}" class="situational-answer" placeholder="Cavabınızı bura yazın..."></textarea>
                            </div>`;
                        });
                    }
                    questionWrapper.innerHTML = `
                    <div class="situational-block">
                        <h3>Situasiya (Sual ${overallQuestionCounter})</h3>
                        <p class="main-text">${item.main_text}</p>
                        ${item.image_path ? `<img src="http://127.0.0.1:5000/uploads/${item.image_path}" alt="Situasiya şəkli">` : ''}
                        <hr>
                        ${subQuestionsHTML}
                    </div>`;
                } else {
                    let optionsHTML = '';
                    if (item.question_type === 'closed' && item.options) {
                        item.options.forEach(opt => {
                            optionsHTML += `
                            <label class="option-label-rich">
                                <input type="radio" name="q${item.id}" value="${opt.variant}">
                                <div class="option-content">
                                    ${opt.text ? `<span>${opt.variant}) ${opt.text}</span>` : `<span>${opt.variant})</span>`}
                                    ${opt.image_path ? `<img src="http://127.0.0.1:5000/uploads/${opt.image_path}" alt="Variant ${opt.variant}">` : ''}
                                </div>
                            </label>`;
                        });
                    } else if (item.question_type === 'open') {
                        optionsHTML = `<textarea name="q${item.id}" class="open-answer" placeholder="Cavabınızı bura yazın..."></textarea>`;
                    } else if (item.question_type === 'multiple_choice' && item.options) {
                        item.options.forEach(opt => {
                            const optionValue = opt.split(')')[0];
                            optionsHTML += `<label><input type="checkbox" name="q${item.id}" value="${optionValue}">${opt}</label>`;
                        });
                    }

                    questionWrapper.innerHTML = `
                    <div class="question-group">
                        <p>${overallQuestionCounter}. ${item.text}</p>
                        ${item.question_image_path ? `<img src="http://127.0.0.1:5000/uploads/${item.question_image_path}" alt="Sual şəkli">` : ''}
                        <div class="options">${optionsHTML}</div>
                    </div>
                `;
                }
                questionsBlock.appendChild(questionWrapper);

                const numBtn = document.createElement('div');
                numBtn.className = 'question-num';
                numBtn.textContent = overallQuestionCounter;
                numBtn.dataset.questionIndex = overallQuestionCounter;
                numBtn.onclick = () => questionWrapper.scrollIntoView({ behavior: 'smooth' });
                questionNumbersContainer.appendChild(numBtn);
            });
        }

        // === YENİ ƏLAVƏ EDİLMİŞ HİSSƏ ===
        // İlk sual üçün sayğacı avtomatik başlat
        const firstQuestion = document.querySelector('.question-wrapper');
        if (firstQuestion) {
            currentQuestionId = firstQuestion.dataset.questionId;
            questionStartTime = new Date().getTime();
        }
        // ===================================
    }


    // Köhnə trackTime funksiyasını və event listener-i silib, bunu əlavə edin

    function trackTimeOnInteraction(event) {
        const questionWrapper = event.target.closest('.question-wrapper');
        if (!questionWrapper) return;

        const questionId = questionWrapper.dataset.questionId;

        // Əgər yeni suala klikləyibsə və bu əvvəlki sual deyilsə
        if (questionId && questionId !== currentQuestionId) {
            const now = new Date().getTime();

            // Əvvəlki sualın vaxtını yekunlaşdır
            if (currentQuestionId && questionStartTime) {
                const timeSpent = now - questionStartTime;
                questionTimings[currentQuestionId] = (questionTimings[currentQuestionId] || 0) + timeSpent;
            }

            // Yeni sual üçün sayğacı başlat
            currentQuestionId = questionId;
            questionStartTime = now;
        }
    }


    if (questionsBlock) {
        questionsBlock.addEventListener('input', trackTimeOnInteraction);
    }

    // Hər hansı bir cavab variantına kliklədikdə və ya yazı yazdıqda vaxtı izləyirik
    if (questionsBlock) {
        questionsBlock.addEventListener('input', (event) => {
            const questionWrapper = event.target.closest('.question-wrapper');
            if (questionWrapper) {
                const questionId = questionWrapper.id.replace('question-', '');
                trackTime(questionId);
            }
        });
    }










    // --- BÜTÜN DİGƏR FUNKSİYALAR OLDUĞU KİMİ QALIR ---
    function startTimer(durationMinutes) {
        if (!timerDisplay) return;
        let time = durationMinutes * 60;
        const interval = setInterval(() => {
            const minutes = Math.floor(time / 60);
            let seconds = time % 60;
            seconds = seconds < 10 ? '0' + seconds : seconds;
            timerDisplay.textContent = `${minutes}:${seconds}`;
            time--;
            if (time < 0) { clearInterval(interval); alert("İmtahan vaxtı bitdi!"); finishExam(); }
        }, 1000);
    }

    function finishExam() {
        // === YENİ ƏLAVƏ: İmtahanı bitirmədən öncə son aktiv sualın vaxtını yekunlaşdırırıq ===
        if (currentQuestionId && questionStartTime) {
            const timeSpent = new Date().getTime() - questionStartTime;
            questionTimings[currentQuestionId] = (questionTimings[currentQuestionId] || 0) + timeSpent;
            currentQuestionId = null; // Sayğacı sıfırlayırıq
        }
        // =================================================================================

        const answers = {};
        questionsBlock.querySelectorAll('input[type="radio"]:checked, textarea.open-answer, textarea.situational-answer').forEach(input => {
            const id = input.name.replace('q', '');
            answers[id] = input.value;
        });
        const checkboxGroups = {};
        questionsBlock.querySelectorAll('input[type="checkbox"]:checked').forEach(input => {
            const id = input.name.replace('q', '');
            if (!checkboxGroups[id]) checkboxGroups[id] = [];
            checkboxGroups[id].push(input.value);
        });
        for (const [key, value] of Object.entries(checkboxGroups)) { answers[key] = value; }

        const submissionData = {
            examId: examId,
            answers: answers,
            timeSpent: questionTimings,
            guestName: urlParams.get('studentName'),
            guestEmail: urlParams.get('studentEmail')
        };

        fetch('http://127.0.0.1:5000/api/exam/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(submissionData)
        })
            .then(res => res.json())
            .then(result => {
                if (result.error) { throw new Error(result.error); }
                if (result.submission_id) {
                    window.location.href = `result.html?submission_id=${result.submission_id}`;
                } else {
                    alert(result.message);
                    window.location.href = 'index.html';
                }
            })
            .catch(error => {
                alert('Nəticələri göndərərkən xəta baş verdi: ' + error.message);
            });
    }

    if (finishExamBtn) {
        finishExamBtn.addEventListener('click', () => {
            if (confirm('İmtahanı bitirmək istədiyinizə əminsiniz?')) { finishExam(); }
        });
    }

    if (questionsBlock) {
        questionsBlock.addEventListener('change', (event) => { handleAnswerChange(event.target); });
        questionsBlock.addEventListener('input', (event) => {
            if (event.target.tagName === 'TEXTAREA') { handleAnswerChange(event.target); }
        });
    }

    function handleAnswerChange(inputElement) {
        const questionWrapper = inputElement.closest('.question-wrapper');
        if (!questionWrapper) return;
        const questionId = questionWrapper.id;
        const questionIndex = questionId.split('-')[1];
        const navButton = document.querySelector(`.question-num[data-question-index='${questionIndex}']`);
        if (!navButton) return;
        let isAnswered = false;
        const inputs = questionWrapper.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]:checked, textarea');
        inputs.forEach(input => {
            if (input.checked || (input.tagName === 'TEXTAREA' && input.value.trim() !== '')) {
                isAnswered = true;
            }
        });
        if (isAnswered) { navButton.classList.add('answered'); }
        else { navButton.classList.remove('answered'); }
    }



    // exam-test.js faylında DOMContentLoaded içinə əlavə edin

    // Cavab variantı seçildikdə vizual effekt vermək üçün
    if (questionsBlock) {
        questionsBlock.addEventListener('change', (e) => {
            // Əgər seçilən element radio düymədirsə
            if (e.target.type === 'radio') {
                const questionGroup = e.target.closest('.question-group');
                if (questionGroup) {
                    // Həmin sualın bütün variantlarından "selected" klassını silirik
                    questionGroup.querySelectorAll('.option-label-rich').forEach(label => {
                        label.classList.remove('selected');
                    });

                    // Yalnız seçilmiş variantın olduğu label-ə "selected" klassını əlavə edirik
                    const selectedLabel = e.target.closest('.option-label-rich');
                    if (selectedLabel) {
                        selectedLabel.classList.add('selected');
                    }
                }
            }
        });
    }





});