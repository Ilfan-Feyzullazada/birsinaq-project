document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTLƏRİN TƏYİN EDİLMƏSİ ---
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
    fetch(`/api/profile`, { credentials: 'include' })
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

    fetch(`/api/exam-test/${examId}`)
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

                let audioPlayerHTML = '';
                if (item.audio_path) {
                    audioPlayerHTML = `
                    <div class="audio-player-wrapper">
                        <p><strong>Dinləmə mətni:</strong></p>
                        <audio controls src="/uploads/${item.audio_path}">Brauzeriniz audio elementini dəstəkləmir.</audio>
                    </div>`;
                }

                if (item.isSituational) {
                    let subQuestionsHTML = '';
                    if (item.sub_questions) {
                        item.sub_questions.forEach(sub_q => {
                            subQuestionsHTML += `
                            <div class="sub-question">
                                <p>${sub_q.text}</p>
                                <textarea name="q${sub_q.id}" class="situational-answer tinymce-student-editor" placeholder="Cavabınızı bura yazın..."></textarea>
                            </div>`;
                        });
                    }
                    questionWrapper.innerHTML = `
                    <div class="situational-block">
                        <h3>Situasiya (Sual ${overallQuestionCounter})</h3>
                        ${audioPlayerHTML}
                        <p class="main-text">${item.main_text}</p>
                        ${item.image_path ? `<img src="/uploads/${item.image_path}" alt="Situasiya şəkli">` : ''}
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
                                    ${opt.image_path ? `<img src="/uploads/${opt.image_path}" alt="Variant ${opt.variant}">` : ''}
                                </div>
                            </label>`;
                        });
                    } else if (item.question_type === 'open') {
                        optionsHTML = `<textarea name="q${item.id}" id="open-answer-${item.id}" class="open-answer tinymce-student-editor" placeholder="Cavabınızı bura yazın..."></textarea>`;
                    } else if (item.question_type === 'matching') {
                        let numberedItemsHTML = '';
                        let letteredItemsHTML = '';
                        if (item.options.numbered_items) {
                            item.options.numbered_items.forEach((text, i) => {
                                numberedItemsHTML += `<li><strong>${i + 1}.</strong> ${text}</li>`;
                            });
                        }
                        if (item.options.lettered_items) {
                            item.options.lettered_items.forEach((text, i) => {
                                const letter = String.fromCharCode(65 + i);
                                letteredItemsHTML += `<li><strong>${letter}.</strong> ${text}</li>`;
                            });
                        }
                        let answerGridHTML = `<div class="matching-answer-grid" data-question-id="${item.id}">`;
                        if (item.options.numbered_items) {
                            item.options.numbered_items.forEach((_, i) => {
                                let answerRow = `<div class="matching-answer-row"><div class="matching-answer-number">${i + 1}</div>`;
                                if (item.options.lettered_items) {
                                    item.options.lettered_items.forEach((_, j) => {
                                        const letter = String.fromCharCode(65 + j);
                                        answerRow += `<div class="grid-bubble" data-num="${i + 1}" data-letter="${letter}">${letter}</div>`;
                                    });
                                }
                                answerRow += '</div>';
                                answerGridHTML += answerRow;
                            });
                        }
                        answerGridHTML += '</div>';
                        optionsHTML = `
                            <div class="matching-student-container">
                                <div class="matching-student-items">
                                    <h4>Nömrələnmiş Bəndlər</h4>
                                    <ul class="matching-list">${numberedItemsHTML}</ul>
                                </div>
                                <div class="matching-student-items">
                                    <h4>Hərflənmiş Bəndlər</h4>
                                    <ul class="matching-list">${letteredItemsHTML}</ul>
                                </div>
                            </div>
                            <h5>Cavabınızı qeyd edin:</h5>
                            ${answerGridHTML}
                        `;
                    } else if (item.question_type === 'fast_tree') {
                        let subQuestionsHTML = '';
                        if (item.options.sub_questions) {
                            item.options.sub_questions.forEach((text, i) => {
                                // --- DÜZƏLİŞ BURADADIR ---
                                subQuestionsHTML += `
                                <div class="fast-tree-student-row">
                                    <span class="fast-tree-student-text">${i + 1}. ${text}</span>
                                    <div class="fast-tree-student-options" data-question-id="${item.id}" data-sub-id="${i + 1}">
                                        <button class="tf-btn" data-value="True">True</button>
                                        <button class="tf-btn" data-value="False">False</button>
                                    </div>
                                </div>`;
                                // --- DÜZƏLİŞİN SONU ---
                            });
                        }
                        optionsHTML = `<div class="fast-tree-student-container">${subQuestionsHTML}</div>`;
                    }

                    questionWrapper.innerHTML = `
                    <div class="question-group">
                        ${audioPlayerHTML}
                        <p>${overallQuestionCounter}. ${item.text}</p>
                        ${item.question_image_path ? `<img src="/uploads/${item.question_image_path}" alt="Sual şəkli">` : ''}
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

        tinymce.init({
            selector: '.tinymce-student-editor',
            plugins: 'lists charmap',
            toolbar: 'bold italic underline | bullist numlist | charmap',
            height: 200,
            menubar: false,
            setup: function (editor) {
                editor.on('change', function () {
                    tinymce.triggerSave();
                });
            }
        });

        const firstQuestion = document.querySelector('.question-wrapper');
        if (firstQuestion) {
            currentQuestionId = firstQuestion.dataset.questionId;
            questionStartTime = new Date().getTime();
        }
    }

    function trackTimeOnInteraction(event) {
        const questionWrapper = event.target.closest('.question-wrapper');
        if (!questionWrapper) return;
        const questionId = questionWrapper.dataset.questionId;
        if (questionId && questionId !== currentQuestionId) {
            const now = new Date().getTime();
            if (currentQuestionId && questionStartTime) {
                const timeSpent = now - questionStartTime;
                questionTimings[currentQuestionId] = (questionTimings[currentQuestionId] || 0) + timeSpent;
            }
            currentQuestionId = questionId;
            questionStartTime = now;
        }
    }

    if (questionsBlock) {
        questionsBlock.addEventListener('input', trackTimeOnInteraction);
    }

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
        if (currentQuestionId && questionStartTime) {
            const timeSpent = new Date().getTime() - questionStartTime;
            questionTimings[currentQuestionId] = (questionTimings[currentQuestionId] || 0) + timeSpent;
            currentQuestionId = null;
        }

        tinymce.triggerSave();

        const answers = {};

        questionsBlock.querySelectorAll('input[type="radio"]:checked, textarea.open-answer, textarea.situational-answer').forEach(input => {
            const id = input.name.replace('q', '');
            answers[id] = input.value;
        });

        questionsBlock.querySelectorAll('.matching-answer-grid').forEach(grid => {
            const questionId = grid.dataset.questionId;
            const studentAnswer = {};
            grid.querySelectorAll('.matching-answer-row').forEach(row => {
                const selectedBubble = row.querySelector('.grid-bubble.selected');
                if (selectedBubble) {
                    studentAnswer[selectedBubble.dataset.num] = selectedBubble.dataset.letter;
                }
            });
            if (Object.keys(studentAnswer).length > 0) {
                answers[questionId] = studentAnswer;
            }
        });

        document.querySelectorAll('.fast-tree-student-options').forEach(optionSet => {
            const questionId = optionSet.dataset.questionId;
            const subId = optionSet.dataset.subId;
            const activeButton = optionSet.querySelector('.tf-btn.active');
            if (activeButton) {
                if (!answers[questionId]) {
                    answers[questionId] = {};
                }
                answers[questionId][subId] = (activeButton.dataset.value === 'True') ? 'A' : 'B';
            }
        });

        const submissionData = {
            examId: examId,
            answers: answers,
            timeSpent: questionTimings,
            guestName: urlParams.get('studentName'),
            guestEmail: urlParams.get('studentEmail')
        };

        fetch('/api/exam/submit', {
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
        const inputs = questionWrapper.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]:checked, textarea, .grid-bubble.selected, .tf-btn.active');
        inputs.forEach(input => {
            if (input.checked || (input.tagName === 'TEXTAREA' && input.value.trim() !== '') || input.classList.contains('selected') || input.classList.contains('active')) {
                isAnswered = true;
            }
        });
        if (isAnswered) { navButton.classList.add('answered'); }
        else { navButton.classList.remove('answered'); }
    }

    if (questionsBlock) {
        questionsBlock.addEventListener('change', (e) => {
            if (e.target.type === 'radio') {
                const questionGroup = e.target.closest('.question-group');
                if (questionGroup) {
                    questionGroup.querySelectorAll('.option-label-rich').forEach(label => {
                        label.classList.remove('selected');
                    });
                    const selectedLabel = e.target.closest('.option-label-rich');
                    if (selectedLabel) {
                        selectedLabel.classList.add('selected');
                    }
                }
            }
        });
    }

    if (questionsBlock) {
        questionsBlock.addEventListener('click', (e) => {
            if (e.target.classList.contains('grid-toggle-btn')) {
                const questionId = e.target.dataset.questionId;
                const grid = document.getElementById(`grid-input-${questionId}`);
                if (grid) {
                    grid.style.display = (grid.style.display === 'none') ? 'flex' : 'none';
                }
            }
            if (e.target.classList.contains('grid-bubble')) {
                const bubble = e.target;
                const container = bubble.closest('.grid-input-container, .matching-answer-grid, .fast-tree-answer-grid');
                if (!container) return;
                
                if (bubble.closest('.matching-answer-row')) {
                    const row = bubble.closest('.matching-answer-row');
                    row.querySelectorAll('.grid-bubble').forEach(b => b.classList.remove('selected'));
                    bubble.classList.add('selected');
                }
                
                handleAnswerChange(bubble);
            }
            
            if (e.target.classList.contains('tf-btn')) {
                const button = e.target;
                const parent = button.parentElement;
                parent.querySelectorAll('.tf-btn').forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                handleAnswerChange(button);
            }
        });
    }
});