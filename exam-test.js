document.addEventListener('DOMContentLoaded', () => {
    // ==========================================================
    // === QLOBAL DƏYİŞƏNLƏR VƏ ƏSAS ELEMENTLƏR ===
    // ==========================================================

    // Yüklənən şəkil fayllarını müvəqqəti saxlamaq üçün obyekt
    // Format: { sual_id: [Fayl1, Fayl2] }
    const uploadedFiles = {};

    // Hər suala sərf olunan vaxtı hesablamaq üçün dəyişənlər
    const questionTimings = {};
    let currentQuestionId = null;
    let questionStartTime = null;

    // URL-dən imtahan ID-sini götürürük
    const urlParams = new URLSearchParams(window.location.search);
    const examId = urlParams.get('examId');

    // Səhifədəki əsas HTML elementlərini seçirik
    const examTitleEl = document.getElementById('exam-title');
    const studentNameEl = document.getElementById('student-name');
    const timerDisplay = document.getElementById('time');
    const questionsBlock = document.getElementById('questions-block');
    const questionNumbersContainer = document.getElementById('question-numbers');
    const subjectNavContainer = document.querySelector('.subject-nav');
    const finishExamBtn = document.getElementById('finish-exam-btn');

    // ==========================================================
    // === İLK YÜKLƏNMƏ PROSESLƏRİ ===
    // ==========================================================

    // Əgər istifadəçi daxil olubsa, profil adını yükləyirik
    fetch(`/api/profile`, { credentials: 'include' })
        .then(res => {
            if (res.ok) { return res.json(); }
            return Promise.reject('Not logged in');
        })
        .then(profileData => {
            if (studentNameEl) studentNameEl.innerText = profileData.name;
        })
        .catch(() => {
            // Əgər daxil olmayıbsa (qonaqdırsa), URL-dən götürülən adı yazırıq
            const studentNameFromUrl = urlParams.get('studentName');
            if (studentNameEl) studentNameEl.innerText = studentNameFromUrl || "Qonaq";
        });

    // İmtahan ID-si olmadan səhifənin işləməməsi üçün yoxlama
    if (!examId) {
        if (questionsBlock) {
            questionsBlock.innerHTML = '<h2 style="color: red; text-align: center;">İmtahan ID-si tapılmadı! Zəhmət olmasa, imtahan siyahısından yenidən seçin.</h2>';
        }
        return;
    }

    // Əsas imtahan məlumatlarını serverdən çəkirik
    fetch(`/api/exam-test/${examId}`)
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw new Error(err.error || 'Server xətası') });
            }
            return response.json();
        })
        .then(data => {
            // Məlumatlar gəldikdən sonra səhifəni qururuq
            if (examTitleEl) examTitleEl.textContent = data.title;
            startTimer(data.duration);
            renderExam(data);
        })
        .catch(error => {
            if (questionsBlock) {
                questionsBlock.innerHTML = `<h2>Xəta: ${error.message}</h2>`;
            }
        });

    // ==========================================================
    // === ŞƏKİL YÜKLƏMƏ FUNKSİYALARI ===
    // ==========================================================

    // Səhifəyə sonradan əlavə edilən elementləri idarə etmək üçün "event delegation"
    document.addEventListener('change', handleSolutionUpload);
    document.addEventListener('click', handleRemovePreview);

    // Şəkil seçildikdə işə düşən funksiya
    function handleSolutionUpload(e) {
        if (!e.target.classList.contains('solution-image-input')) return;

        const input = e.target;
        const subQuestionId = input.closest('.sub-question').dataset.subQuestionId;
        const previewContainer = document.getElementById(input.dataset.targetPreview);

        if (!uploadedFiles[subQuestionId]) {
            uploadedFiles[subQuestionId] = [];
        }

        const files = Array.from(input.files);

        // Maksimum 2 şəkil limiti
        if (uploadedFiles[subQuestionId].length + files.length > 2) {
            alert("Bir sual üçün maksimum 2 şəkil yükləyə bilərsiniz.");
            input.value = ""; // Fayl seçimini ləğv edir
            return;
        }

        // Hər bir seçilən fayl üçün önizləmə (preview) yaradır
        files.forEach(file => {
            uploadedFiles[subQuestionId].push(file); // Faylı qlobal yaddaşa əlavə edir
            const reader = new FileReader();
            reader.onload = (event) => {
                const wrapper = document.createElement('div');
                wrapper.className = 'preview-image-wrapper';
                wrapper.innerHTML = `
                    <img src="${event.target.result}" class="preview-image" alt="Önizləmə">
                    <button class="remove-preview-btn" data-sub-question-id="${subQuestionId}" data-file-name="${file.name}">&times;</button>
                `;
                previewContainer.appendChild(wrapper);
            };
            reader.readAsDataURL(file);
        });

        input.value = ""; // Eyni faylı təkrar seçə bilmək üçün
    }

    // Önizləmədəki 'x' düyməsinə basanda işə düşən funksiya
    function handleRemovePreview(e) {
        if (!e.target.classList.contains('remove-preview-btn')) return;

        const btn = e.target;
        const subQuestionId = btn.dataset.subQuestionId;
        const fileName = btn.dataset.fileName;

        // Faylı qlobal yaddaşdan silir
        uploadedFiles[subQuestionId] = uploadedFiles[subQuestionId].filter(file => file.name !== fileName);

        // Önizləmə şəklini ekrandan silir
        btn.parentElement.remove();
    }


    // ==========================================================
    // === İMTAHANIN QURULMASI VƏ İDARƏ EDİLMƏSİ ===
    // ==========================================================

    function renderExam(data) {
        // Bu funksiya imtahan məlumatlarını alıb səhifəni qurur
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
                    audioPlayerHTML = `<div class="audio-player-wrapper"><p><strong>Dinləmə mətni:</strong></p><audio controls src="/uploads/${item.audio_path}">Brauzeriniz audio elementini dəstəkləmir.</audio></div>`;
                }
                if (item.isSituational) {
                    let subQuestionsHTML = '';
                    if (item.sub_questions) {
                        item.sub_questions.forEach(sub_q => {
                            // exam-test.js -> renderExam funksiyasında, if(item.isSituational) blokunun içini dəyişin

                            // Köhnə subQuestionsHTML += ... sətrini tapıb, aşağıdakı kodla əvəz edin
                            subQuestionsHTML += `
    <div class="sub-question" data-sub-question-id="${sub_q.id}">
        <p class="question-text">${sub_q.text}</p>

        <div class="written-answer-container">
            <textarea id="text-answer-${sub_q.id}" class="tinymce-student-editor"></textarea>
        </div>

        <div class="solution-upload-container">
            <p class="upload-instructions">💡 Və ya həllinizi vərəqdə yazıb şəklini çəkərək yükləyin. (Maks. 2 şəkil)</p>
            <div class="image-previews" id="previews-${sub_q.id}"></div>
            <label class="upload-btn-label">
                <i class="fas fa-camera"></i> Şəkil Yüklə
                <input type="file" class="solution-image-input" data-target-preview="previews-${sub_q.id}" accept="image/jpeg, image/png, image/jpg" multiple>
            </label>
        </div>
    </div>
`;
                        });
                    }
                    questionWrapper.innerHTML = `<div class="situational-block"><h3>Situasiya (Sual ${overallQuestionCounter})</h3>${audioPlayerHTML}<p class="main-text">${item.main_text}</p>${item.image_path ? `<img src="/uploads/${item.image_path}" alt="Situasiya şəkli">` : ''}<hr>${subQuestionsHTML}</div>`;
                } else {
                    let optionsHTML = '';
                    if (item.question_type === 'closed' && item.options) {
                        item.options.forEach(opt => {
                            optionsHTML += `<label class="option-label-rich"><input type="radio" name="q${item.id}" value="${opt.variant}"><div class="option-content">${opt.text ? `<span>${opt.variant}) ${opt.text}</span>` : `<span>${opt.variant})</span>`}${opt.image_path ? `<img src="/uploads/${opt.image_path}" alt="Variant ${opt.variant}">` : ''}</div></label>`;
                        });
                    } // exam-test.js -> renderExam funksiyasının içindəki 'open' hissəsi

                    else if (item.question_type === 'open') {
                        let gridHTML = '<div class="grid-input-container">';
                        gridHTML += `<input type="text" name="q${item.id}" class="grid-display open-answer" readonly placeholder="Cavabınız...">`;
                        gridHTML += '<div class="grid-columns">';
                        for (let i = 0; i < 6; i++) {
                            gridHTML += `<div class="grid-column" data-column-index="${i}">`;
                            for (let j = 0; j <= 9; j++) {
                                gridHTML += `<div class="grid-bubble" data-value="${j}">${j}</div>`;
                            }
                            gridHTML += `<div class="grid-bubble" data-value=",">,</div>`; // <-- YENİ ƏLAVƏ OLUNAN SƏTİR

                            gridHTML += '</div>';
                        }
                        gridHTML += '</div></div>';
                        optionsHTML = gridHTML; // optionsHTML-ə bu yeni interfeysi mənimsədirik

                    } else if (item.question_type === 'matching') {
                        let numberedItemsHTML = '';
                        let letteredItemsHTML = '';
                        if (item.options.numbered_items) { item.options.numbered_items.forEach((text, i) => { numberedItemsHTML += `<li><strong>${i + 1}.</strong> ${text}</li>`; }); }
                        if (item.options.lettered_items) { item.options.lettered_items.forEach((text, i) => { const letter = String.fromCharCode(65 + i); letteredItemsHTML += `<li><strong>${letter}.</strong> ${text}</li>`; }); }
                        let answerGridHTML = `<div class="matching-answer-grid" data-question-id="${item.id}">`;
                        if (item.options.numbered_items) { item.options.numbered_items.forEach((_, i) => { let answerRow = `<div class="matching-answer-row"><div class="matching-answer-number">${i + 1}</div>`; if (item.options.lettered_items) { item.options.lettered_items.forEach((_, j) => { const letter = String.fromCharCode(65 + j); answerRow += `<div class="grid-bubble" data-num="${i + 1}" data-letter="${letter}">${letter}</div>`; }); } answerRow += '</div>'; answerGridHTML += answerRow; }); }
                        answerGridHTML += '</div>';
                        optionsHTML = `<div class="matching-student-container"><div class="matching-student-items"><h4>Nömrələnmiş Bəndlər</h4><ul class="matching-list">${numberedItemsHTML}</ul></div><div class="matching-student-items"><h4>Hərflənmiş Bəndlər</h4><ul class="matching-list">${letteredItemsHTML}</ul></div></div><h5>Cavabınızı qeyd edin:</h5>${answerGridHTML}`;
                    } else if (item.question_type === 'fast_tree') {
                        let subQuestionsHTML = '';
                        if (item.options.sub_questions) { item.options.sub_questions.forEach((text, i) => { subQuestionsHTML += `<div class="fast-tree-student-row"><span class="fast-tree-student-text">${i + 1}. ${text}</span><div class="fast-tree-student-options" data-question-id="${item.id}" data-sub-id="${i + 1}"><button class="tf-btn" data-value="True">True</button><button class="tf-btn" data-value="False">False</button></div></div>`; }); }
                        optionsHTML = `<div class="fast-tree-student-container">${subQuestionsHTML}</div>`;
                    }

                    // ===== ƏSAS DƏYİŞİKLİK BURADADIR =====
                    questionWrapper.innerHTML = `
                <div class="question-group">
                    ${audioPlayerHTML}
                    <div class="question-text-container">
                        <span class="question-number">${overallQuestionCounter}.</span>
                        <span class="question-text">${item.text}</span>
                    </div>
                    ${item.question_image_path ? `<img src="/uploads/${item.question_image_path}" alt="Sual şəkli">` : ''}
                    <div class="options">${optionsHTML}</div>
                </div>`;
                    // ===== DƏYİŞİKLİYİN SONU =====
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
        // exam-test.js -> renderExam funksiyasının sonuna (if(firstQuestion) sətrindən əvvəl) əlavə edin
        tinymce.init({
            selector: '.tinymce-student-editor',
            plugins: 'lists charmap',
            toolbar: 'bold italic underline | bullist numlist | charmap',
            height: 200,
            menubar: false,
            setup: function (editor) {
                // Redaktorda hər hansı bir dəyişiklik olanda cavabın qeyd olunmasını təmin edir
                editor.on('change', function () {
                    tinymce.triggerSave();
                    handleAnswerChange(editor.getElement());
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
        // KLİK HADİSƏLƏRİNİ İDARƏ EDİR
        questionsBlock.addEventListener('click', (e) => {
            // Kodlaşdırma vərəqini (bubble grid) idarə edir
            // exam-test.js -> click listener içində bu bloku yeniləyin
            if (e.target.classList.contains('grid-bubble')) {
                const bubble = e.target;
                const column = bubble.parentElement;
                const container = column.parentElement.parentElement;
                const display = container.querySelector('.grid-display');

                // Seçimi ləğv etmə və dəyişmə məntiqi
                if (bubble.classList.contains('selected')) {
                    bubble.classList.remove('selected');
                } else {
                    column.querySelectorAll('.grid-bubble').forEach(b => b.classList.remove('selected'));
                    bubble.classList.add('selected');
                }

                // Yuxarıdakı xanada cavabı vergüllə yeniləyir
                let answerParts = [];
                container.querySelectorAll('.grid-column').forEach(col => {
                    const selectedBubble = col.querySelector('.grid-bubble.selected');
                    if (selectedBubble) {
                        answerParts.push(selectedBubble.dataset.value);
                    }
                });
                // Vergül məntiqi: Yalnız rəqəmlər arasında vergül qoyur
                let finalAnswer = answerParts.join(' ');
                display.value = finalAnswer;

                // Naviqasiya düyməsinin rəngini dəyişmək üçün
                handleAnswerChange(bubble);
            }

            // Doğru/Yalan (Fast Tree) sualları üçün
            if (e.target.classList.contains('tf-btn')) {
                const button = e.target;
                const parent = button.parentElement;
                parent.querySelectorAll('.tf-btn').forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                handleAnswerChange(button);
            }
        });

        // VARİANT SEÇİMİNİ İDARƏ EDİR
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
            // Cavab verildikdə naviqasiya düyməsinin rəngini dəyişmək üçün
            handleAnswerChange(e.target);
        });

        // Yazılı cavabları idarə edir
        questionsBlock.addEventListener('input', (event) => {
            if (event.target.tagName === 'TEXTAREA') {
                handleAnswerChange(event.target);
            }
        });
    }

    // ==========================================================
    // === YENİLƏNMİŞ `finishExam` FUNKSİYASI ===
    // ==========================================================
    function finishExam() {
        // Vaxt hesablamasını yekunlaşdırırıq
        if (currentQuestionId && questionStartTime) {
            const timeSpent = new Date().getTime() - questionStartTime;
            questionTimings[currentQuestionId] = (questionTimings[currentQuestionId] || 0) + timeSpent;
            currentQuestionId = null;
        }
        tinymce.triggerSave();

        // Fayl və mətnləri birlikdə göndərmək üçün FormData obyekti yaradırıq
        const formData = new FormData();

        // 1. Mətn və variant cavablarını toplayırıq
        const textAnswers = {};

        // Qapalı və açıq tipli sualların cavabları
        questionsBlock.querySelectorAll('input[type="radio"]:checked, textarea.open-answer').forEach(input => {
            const id = input.name.replace('q', '');
            textAnswers[id] = input.value;
        });

        // Uyğunlaşdırma suallarının cavabları
        questionsBlock.querySelectorAll('.matching-answer-grid').forEach(grid => {
            const questionId = grid.dataset.questionId;
            const studentAnswer = {};
            grid.querySelectorAll('.matching-answer-row .grid-bubble.selected').forEach(selectedBubble => {
                studentAnswer[selectedBubble.dataset.num] = selectedBubble.dataset.letter;
            });
            if (Object.keys(studentAnswer).length > 0) {
                textAnswers[questionId] = studentAnswer;
            }
        });

        // Doğru/Yalan (Fast Tree) suallarının cavabları
        document.querySelectorAll('.fast-tree-student-options').forEach(optionSet => {
            const questionId = optionSet.dataset.questionId;
            const subId = optionSet.dataset.subId;
            const activeButton = optionSet.querySelector('.tf-btn.active');
            if (activeButton) {
                if (!textAnswers[questionId]) {
                    textAnswers[questionId] = {};
                }
                textAnswers[questionId][subId] = (activeButton.dataset.value === 'True') ? 'A' : 'B';
            }
        });


        // Situasiya suallarının YAZILI cavablarını toplayırıq
        questionsBlock.querySelectorAll('.tinymce-student-editor').forEach(textarea => {
            const subQuestion = textarea.closest('.sub-question');
            if (subQuestion) {
                const subQuestionId = subQuestion.dataset.subQuestionId;
                if (textarea.value.trim() !== '') {
                    // Cavabları düzgün formatda yığırıq
                    if (!textAnswers[subQuestionId]) {
                        textAnswers[subQuestionId] = {};
                    }
                    textAnswers[subQuestionId].text = textarea.value;
                }
            }
        });

        // 2. Toplanan mətn cavablarını və digər məlumatları FormData-ya əlavə edirik
        formData.append('answers', JSON.stringify(textAnswers));
        formData.append('timeSpent', JSON.stringify(questionTimings));
        formData.append('examId', examId);
        formData.append('guestName', urlParams.get('studentName'));
        formData.append('guestEmail', urlParams.get('studentEmail'));

        // 3. Yüklənmiş şəkilləri FormData-ya əlavə edirik
        for (const subQuestionId in uploadedFiles) {
            uploadedFiles[subQuestionId].forEach((file) => {
                // Hər faylı serverin tanıması üçün xüsusi adla göndəririk
                formData.append(`images_${subQuestionId}`, file, file.name);
            });
        }

        // 4. Bütün məlumatları (mətnlər + şəkillər) serverə göndəririk
        fetch('/api/exam/submit', {
            method: 'POST',
            credentials: 'include',
            body: formData // FormData göndərildiyi üçün 'Content-Type' təyin edilmir
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

    // "İmtahanı Bitir" düyməsinə klik hadisəsi
    if (finishExamBtn) {
        finishExamBtn.addEventListener('click', () => {
            if (confirm('İmtahanı bitirmək istədiyinizə əminsiniz?')) {
                finishExam();
            }
        });
    }
});