// admin-dashboard.js - BÜTÜN FUNKSİYALAR SAXLANILMIŞ VƏ DÜZƏLİŞ EDİLMİŞ TAM KOD
document.addEventListener('DOMContentLoaded', () => {
    // --- ÜMUMİ ELEMENTLƏR VƏ NAVİQASİYA ---
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.dashboard-section');
    const logoutBtn = document.getElementById('admin-logout-btn');

    // Məlumatları saxlamaq üçün qlobal dəyişənlər
    let subjects = [];
    let allOrganizers = [];

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = item.querySelector('a').getAttribute('href').substring(1);

            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            sections.forEach(section => section.classList.toggle('active', section.id === targetId));

            // Hər bölməyə keçdikdə müvafiq funksiyanı çağırırıq
            if (targetId === 'exams') loadExams();
            if (targetId === 'organizers') loadOrganizers();
            if (targetId === 'students') loadStudents();
            if (targetId === 'teachers') setupTeachersSection();
            if (targetId === 'create-exam' && subjects.length === 0) {
                loadExamMetaData();
            }
        });
    });

    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            fetch('/api/logout', { method: 'POST', credentials: 'include' })
                .then(() => window.location.href = 'login.html');
        });
    }

    // --- İMTAHANLAR BÖLMƏSİ ---
    const examsTableBody = document.getElementById('exams-table-body');
    function loadExams() {
        if (!examsTableBody) return;
        fetch('/api/admin/exams', { credentials: 'include' })
            .then(response => response.json())
            .then(exams => {
                examsTableBody.innerHTML = '';
                if (!exams || exams.length === 0) {
                    examsTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Heç bir imtahan yaradılmayıb.</td></tr>';
                } else {
                    exams.forEach(exam => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td>${exam.name}</td>
                            <td>${exam.question_count}</td>
                            <td>${exam.is_active ? 'Aktiv' : 'Planlanmış'}</td>
                            <td class="actions">
                                <button class="delete-btn" data-exam-id="${exam.id}">Sil</button>
                            </td>
                        `;
                        examsTableBody.appendChild(tr);
                    });
                }
            }).catch(() => {
                examsTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">İmtahanları yükləmək mümkün olmadı.</td></tr>';
            });
    }
    if (examsTableBody) {
        examsTableBody.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-btn')) {
                const examId = e.target.dataset.examId;
                if (confirm('Bu imtahanı silmək istədiyinizə əminsiniz?')) {
                    fetch(`/api/admin/exams/${examId}`, { method: 'DELETE', credentials: 'include' })
                        .then(res => res.json())
                        .then(result => {
                            alert(result.message);
                            loadExams();
                        });
                }
            }
        });
    }

    // --- ŞAGİRDLƏR BÖLMƏSİ ---
    function loadStudents() {
        const registeredBody = document.getElementById('registered-students-table-body');
        const guestBody = document.getElementById('guest-submissions-table-body');
        if (!registeredBody || !guestBody) return;

        fetch('/api/admin/students', { credentials: 'include' })
            .then(response => response.json())
            .then(data => {
                const { registeredStudents, guestSubmissions } = data;
                registeredBody.innerHTML = '';
                if (!registeredStudents || registeredStudents.length === 0) {
                    registeredBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Sistemdə qeydiyyatdan keçən şagird yoxdur.</td></tr>';
                } else {
                    registeredStudents.forEach(student => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td>${student.name}</td>
                            <td>${student.email}</td>
                            <td>${student.school}</td>
                            <td>${student.class}</td>
                            <td>${student.submissions.length}</td>
                        `;
                        registeredBody.appendChild(tr);
                    });
                }
                guestBody.innerHTML = '';
                if (!guestSubmissions || guestSubmissions.length === 0) {
                    guestBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Hesaba bağlanmamış qonaq iştirakçı yoxdur.</td></tr>';
                } else {
                    guestSubmissions.forEach(sub => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td>${sub.guestName}</td>
                            <td>${sub.guestEmail}</td>
                            <td>${sub.examName}</td>
                            <td>${sub.score} bal</td>
                            <td>${sub.submittedAt}</td>
                        `;
                        guestBody.appendChild(tr);
                    });
                }
            }).catch(error => {
                console.error("Şagirdləri yükləyərkən xəta:", error);
                registeredBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Məlumatları yükləmək mümkün olmadı.</td></tr>';
                guestBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Məlumatları yükləmək mümkün olmadı.</td></tr>';
            });
    }

    // --- TƏŞKİLATÇILAR BÖLMƏSİNİN BÜTÜN MƏNTİQİ ---
    function loadOrganizers() {
        const organizersTableBody = document.getElementById('organizers-table-body');
        if (!organizersTableBody) return;
        fetch('/api/admin/organizers', { credentials: 'include' })
            .then(response => response.json())
            .then(organizers => {
                allOrganizers = organizers;
                organizersTableBody.innerHTML = '';
                if (!organizers || organizers.length === 0) {
                    organizersTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Heç bir təşkilatçı qeydiyyatdan keçməyib.</td></tr>';
                    return;
                }
                organizers.forEach(org => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                    <td>${org.name}</td>
                    <td>${org.email}</td>
                    <td>${org.contact}</td>
                    <td>${org.bank_account}</td>
                    <td>${org.balance.toFixed(2)}</td>
                    <td>${org.commission_amount.toFixed(2)}</td>
                    <td class="actions">
                        <button class="edit-btn edit-organizer-btn" data-org-id="${org.id}">Redaktə Et</button>
                        <button class="reset-balance-btn" data-org-id="${org.id}">Balansı Sıfırla</button>
                    </td>
                `;
                    organizersTableBody.appendChild(tr);
                });
            })
            .catch(error => {
                console.error('Təşkilatçıları yükləyərkən xəta:', error);
                organizersTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Məlumatları yükləmək mümkün olmadı.</td></tr>';
            });
    }

    const organizersSection = document.getElementById('organizers');
    const modal = document.getElementById('organizer-edit-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const editForm = document.getElementById('organizer-edit-form');

    if (organizersSection) {
        organizersSection.addEventListener('click', (e) => {
            if (e.target.classList.contains('edit-organizer-btn')) {
                const orgId = parseInt(e.target.dataset.orgId, 10);
                const organizerData = allOrganizers.find(org => org.id === orgId);
                if (organizerData) {
                    document.getElementById('edit-org-id').value = organizerData.id;
                    document.getElementById('edit-org-name').value = organizerData.name;
                    document.getElementById('edit-org-email').value = organizerData.email;
                    document.getElementById('edit-org-contact').value = organizerData.contact;
                    document.getElementById('edit-org-bank').value = organizerData.bank_account;
                    document.getElementById('edit-org-commission').value = organizerData.commission_amount;
                    modal.style.display = 'block';
                }
            }
            if (e.target.classList.contains('reset-balance-btn')) {
                const orgId = e.target.dataset.orgId;
                if (confirm('Bu təşkilatçının balansını sıfırlamaq istədiyinizə əminsiniz?')) {
                    fetch(`/api/admin/organizer/${orgId}/reset-balance`, {
                        method: 'POST',
                        credentials: 'include'
                    })
                        .then(res => res.json())
                        .then(result => {
                            alert(result.message);
                            loadOrganizers();
                        });
                }
            }
        });
    }

    if (closeModalBtn) { closeModalBtn.onclick = () => { modal.style.display = 'none'; } }
    window.onclick = (event) => { if (event.target == modal) { modal.style.display = 'none'; } }

    if (editForm) {
        editForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const orgId = document.getElementById('edit-org-id').value;
            const updatedData = {
                name: document.getElementById('edit-org-name').value,
                email: document.getElementById('edit-org-email').value,
                contact: document.getElementById('edit-org-contact').value,
                bank_account: document.getElementById('edit-org-bank').value,
                commission_amount: document.getElementById('edit-org-commission').value
            };
            fetch(`/api/admin/organizer/${orgId}/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(updatedData)
            })
                .then(res => res.json().then(data => ({ ok: res.ok, data })))
                .then(({ ok, data }) => {
                    alert(data.message);
                    if (ok) {
                        modal.style.display = 'none';
                        loadOrganizers();
                    }
                });
        });
    }

    // --- MÜƏLLİMLƏRİN İDARƏ EDİLMƏSİ BÖLMƏSİ ---
    function setupTeachersSection() {
        const createTeacherForm = document.getElementById('create-teacher-form');
        const teachersTableBody = document.getElementById('teachers-table-body');
        const teacherSubjectSelect = document.getElementById('teacher-subject');
        if (teacherSubjectSelect && subjects.length > 0) {
            teacherSubjectSelect.innerHTML = '<option value="">Fənn seçin...</option>';
            subjects.forEach(subject => {
                const option = document.createElement('option');
                option.value = subject.id;
                option.textContent = subject.name;
                teacherSubjectSelect.appendChild(option);
            });
        }
        function loadTeachers() {
            if (!teachersTableBody) return;
            fetch('/api/admin/teachers', { credentials: 'include' })
                .then(res => res.json())
                .then(teachers => {
                    teachersTableBody.innerHTML = '';
                    if (teachers.length === 0) {
                        teachersTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Sistemdə müəllim yoxdur.</td></tr>';
                    } else {
                        teachers.forEach(teacher => {
                            const tr = document.createElement('tr');
                            tr.innerHTML = `
                                <td>${teacher.name}</td>
                                <td>${teacher.email}</td>
                                <td>${teacher.subject}</td>
                                <td class="actions">
                                    <button class="delete-btn delete-teacher-btn" data-teacher-id="${teacher.id}">Sil</button>
                                </td>
                            `;
                            teachersTableBody.appendChild(tr);
                        });
                    }
                });
        }
        if (createTeacherForm) {
            createTeacherForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const teacherData = {
                    name: document.getElementById('teacher-name').value,
                    email: document.getElementById('teacher-email').value,
                    password: document.getElementById('teacher-password').value,
                    subject_id: document.getElementById('teacher-subject').value
                };
                fetch('/api/admin/teachers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(teacherData)
                })
                    .then(res => res.json().then(data => ({ ok: res.ok, data })))
                    .then(({ ok, data }) => {
                        alert(data.message);
                        if (ok) {
                            createTeacherForm.reset();
                            loadTeachers();
                        }
                    });
            });
        }
        if (teachersTableBody) {
            teachersTableBody.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-teacher-btn')) {
                    const teacherId = e.target.dataset.teacherId;
                    if (confirm('Bu müəllimi silmək istədiyinizə əminsiniz?')) {
                        fetch(`/api/admin/teachers/${teacherId}`, {
                            method: 'DELETE',
                            credentials: 'include'
                        })
                            .then(res => res.json().then(data => ({ ok: res.ok, data })))
                            .then(({ ok, data }) => {
                                alert(data.message);
                                if (ok) {
                                    loadTeachers();
                                }
                            });
                    }
                }
            });
        }
        loadTeachers();
    }

    // --- İMTAHAN YARAT BÖLMƏSİ ---
    const createExamForm = document.getElementById('create-exam-form');
    const questionsContainer = document.getElementById('questions-container');
    const addQuestionBtn = document.getElementById('add-question-btn');
    let questionCounter = 0;
    function populateSelect(selectElement, items) {
        if (!selectElement) return;
        selectElement.innerHTML = '';
        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = item.name;
            selectElement.appendChild(option);
        });
    }
    function loadExamMetaData() {
        fetch('/api/admin/exam-meta', { credentials: 'include' })
            .then(res => res.json())
            .then(data => {
                subjects = data.subjects;
                populateSelect(document.getElementById('exam-type'), data.examTypes);
                populateSelect(document.getElementById('class-name'), data.classNames);
            });
    }
    if (addQuestionBtn) {
        addQuestionBtn.addEventListener('click', () => {
            questionCounter++;
            const questionBlock = document.createElement('div');
            questionBlock.classList.add('question-block');
            questionBlock.id = `question-block-${questionCounter}`;
            let subjectOptions = subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
            questionBlock.innerHTML = `
    
    <h4>Sual ${questionCounter} <button type="button" class="remove-question-btn">Sil</button></h4>
    
    <div class="form-group">
        <label>Sualın Tipi</label>
        <select class="question-type-select" data-block-id="${questionCounter}">
            <option value="closed" selected>Qapalı Sual (A,B,C,D,E)</option>
            <option value="open">Açıq Sual (Mətn)</option>
            <option value="multiple_choice">Kodlaşdırma (Çoxseçimli)</option>
            <option value="situational">Situasiya Bloku</option>
        </select>
    </div>

    <div id="main-fields-${questionCounter}">
        <div class="form-group">
            <label>Fənn</label>
            <div class="select-with-add">
                <select class="question-subject" required>${subjectOptions}</select>
                <button type="button" class="add-new-meta-btn" data-type="subjects" data-name="Fənn">+</button>
            </div>
        </div>
        
        <div class="form-grid">
            <div class="form-group">
                <label>Mövzu</label>
                <input type="text" class="question-topic" placeholder="Sualın aid olduğu mövzu...">
            </div>
            <div class="form-group">
                <label>Çətinlik Dərəcəsi</label>
                <select class="question-difficulty">
                    <option value="Asan">Asan</option>
                    <option value="Orta">Orta</option>
                    <option value="Çətin">Çətin</option>
                    <option value="Mürəkkəb">Mürəkkəb</option>
                </select>
            </div>
        </div>

        


<div class="form-group">
    <label>Videoizah üçün Başlanğıc Vaxtı (dəqiqə:saniyə)</label>
    <div class="time-input-container">
        <input type="number" class="time-input-minutes" min="0" max="599" placeholder="MM" value="0">
        <span class="time-input-separator">:</span>
        <input type="number" class="time-input-seconds" min="0" max="59" placeholder="SS" value="0">
    </div>
</div>

        <div class="form-group">
            <label>Sualın Mətni</label>
            <textarea class="question-text" required></textarea>
        </div>

        <div class="form-group">
            <label>Sual üçün Şəkil (İstəyə bağlı)</label>
            <input type="file" class="question-image" accept="image/*">
        </div>
    </div>

    <div class="question-type-specific" id="specific-area-${questionCounter}"></div>
`;
            questionsContainer.appendChild(questionBlock);
            renderSpecificFields('closed', questionCounter);
        });
    }
    function renderSpecificFields(type, blockId) {
        const specificArea = document.getElementById(`specific-area-${blockId}`);
        const mainFields = document.getElementById(`main-fields-${blockId}`);
        let content = '';
        const subjectLabel = mainFields.querySelector('.question-subject').closest('.form-group').querySelector('label');
        const textLabel = mainFields.querySelector('.question-text').closest('.form-group').querySelector('label');

        subjectLabel.textContent = 'Fənn';
        textLabel.textContent = 'Sualın Mətni';
        mainFields.style.display = 'block';

        switch (type) {
            case 'open':
                content = `<div class="form-group"><label>Düzgün Cavab</label><input type="text" class="correct-answer-open" required></div>`;
                break;
            case 'multiple_choice':
                content = `<p>Variantları daxil edin və düzgün olanları işarələyin:</p>${[...Array(5)].map((_, i) => `<div class="form-group-inline mc-option"><input type="checkbox" class="mc-correct-checkbox" data-variant="${i + 1}"><label>${i + 1})</label><input type="text" class="mc-option-text" placeholder="Variant ${i + 1}"></div>`).join('')}`;
                break;
            case 'situational':
                subjectLabel.textContent = 'Fənn (Bütün alt-suallar üçün eyni olacaq)';
                textLabel.textContent = 'Situasiyanın Ana Mətni';
                content = `<div class="form-group"><label>Situasiya üçün Şəkil Yüklə (İstəyə bağlı)</label><input type="file" class="situational-image" accept="image/*"></div><hr><h5>Situasiyaya aid Alt-Suallar</h5><div class="sub-questions-container"></div><button type="button" class="add-sub-question-btn" data-parent-id="${blockId}">+ Alt-Sual Əlavə Et</button>`;
                break;
            default: // 'closed' üçün yeni, daha mürəkkəb HTML
                const variants = ['A', 'B', 'C', 'D', 'E'];
                let optionsHTML = variants.map(v => `
                    <div class="form-group option-block">
                        <label>Variant ${v}</label>
                        <div class="option-input-group">
                           <input type="text" class="option-text" data-variant="${v}" placeholder="${v} variantının mətni...">
                           <input type="file" class="option-image" data-variant="${v}" accept="image/*">
                        </div>
                    </div>
                `).join('');

                content = `
                    <div class="options-container">${optionsHTML}</div>
                    <div class="form-group">
                        <label>Düzgün Cavab Variantı</label>
                        <select class="correct-answer-closed" required>
                            <option value="A">A</option>
                            <option value="B">B</option>
                            <option value="C">C</option>
                            <option value="D">D</option>
                            <option value="E">E</option>
                        </select>
                    </div>`;
                break;
        }
        specificArea.innerHTML = content;
    }
    if (questionsContainer) {
        questionsContainer.addEventListener('change', e => { if (e.target.classList.contains('question-type-select')) { renderSpecificFields(e.target.value, e.target.dataset.blockId); } });
        questionsContainer.addEventListener('click', e => {
            if (e.target.classList.contains('remove-question-btn')) { e.target.closest('.question-block').remove(); }
            if (e.target.classList.contains('add-sub-question-btn')) {
                const subContainer = e.target.previousElementSibling;
                const subQuestionCount = subContainer.children.length + 1;
                const subQuestion = document.createElement('div');
                subQuestion.className = 'form-group sub-question-item';
                subQuestion.innerHTML = `<label>Alt-Sual ${subQuestionCount}</label><input type="text" class="sub-question-text" required placeholder="Alt-sualın mətnini bura yazın">`;
                subContainer.appendChild(subQuestion);
            }
        });
    }
    if (createExamForm) {
        createExamForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData();
            formData.append('title', document.getElementById('exam-title').value);
            formData.append('examTypeId', document.getElementById('exam-type').value);
            formData.append('classNameId', document.getElementById('class-name').value);
            formData.append('duration', document.getElementById('exam-duration').value);
            formData.append('price', document.getElementById('exam-price').value);
            formData.append('video_url', document.getElementById('exam-video-url').value);
            formData.append('publishImmediately', document.querySelector('input[name="publishStatus"]:checked').value === 'immediate');
            formData.append('publishDate', document.getElementById('publish-date').value);
            const questionsData = [];

            // ======================== DƏYİŞİKLİK BURADA BAŞLAYIR ========================

            // Köhnə forEach blokunu silib, bunu yapışdırın
            document.querySelectorAll('.question-block').forEach((block, index) => {
                const questionType = block.querySelector('.question-type-select').value;

                // ====================================================================
                // === DƏYİŞİKLİK BURADADIR: Dəqiqə və saniyəni birləşdiririk ===
                // ====================================================================

                // 1. Dəqiqə və saniyə xanalarını tapırıq
                const minutesInput = block.querySelector('.time-input-minutes');
                const secondsInput = block.querySelector('.time-input-seconds');

                // 2. Dəyərləri alıb, əgər təkrəqəmlidirsə başına "0" əlavə edirik (məs: 5 -> "05")
                const minutes = minutesInput ? String(minutesInput.value).padStart(2, '0') : '00';
                const seconds = secondsInput ? String(secondsInput.value).padStart(2, '0') : '00';

                // 3. Yekun "MM:SS" formatını yaradırıq
                const formattedStartTime = `${minutes}:${seconds}`;

                // ====================================================================

                const commonData = {
                    question_type: questionType,
                    // === DƏYİŞİKLİK BURADADIR: Hazırladığımız yeni formatı istifadə edirik ===
                    video_start_time: (minutesInput && secondsInput) ? formattedStartTime : null,
                    subject_id: block.querySelector('.question-subject')?.value,
                    text: block.querySelector('.question-text')?.value,
                    topic: block.querySelector('.question-topic')?.value,
                    difficulty: block.querySelector('.question-difficulty')?.value,
                    options: [],
                    correct_answer: [],
                    sub_questions: []
                };

                // Hər sualın öz ümumi şəkli ola bilər
                const mainImageFile = block.querySelector('.question-image').files[0];
                if (mainImageFile) {
                    formData.append(`question_image_${index}`, mainImageFile);
                }

                // --- HƏR BİR SUAL NÖVÜ ÜÇÜN XÜSUSİ MƏNTİQ (bu hissə olduğu kimi qalır) ---
                if (questionType === 'closed') {
                    const optionTexts = [];
                    ['A', 'B', 'C', 'D', 'E'].forEach(variant => {
                        const textInput = block.querySelector(`.option-text[data-variant="${variant}"]`);
                        optionTexts.push(textInput ? textInput.value : "");

                        const imageInput = block.querySelector(`.option-image[data-variant="${variant}"]`);
                        if (imageInput && imageInput.files[0]) {
                            formData.append(`option_image_${index}_${variant}`, imageInput.files[0]);
                        }
                    });
                    commonData.options = optionTexts;
                    commonData.correct_answer = [block.querySelector('.correct-answer-closed').value];

                } else if (questionType === 'open') {
                    commonData.correct_answer = block.querySelector('.correct-answer-open').value;

                } else if (questionType === 'multiple_choice') {
                    const correctAnswers = [];
                    block.querySelectorAll('.mc-option-text').forEach(input => {
                        commonData.options.push(input.value);
                    });
                    block.querySelectorAll('.mc-correct-checkbox:checked').forEach(checkbox => {
                        correctAnswers.push(checkbox.dataset.variant);
                    });
                    commonData.correct_answer = correctAnswers;

                } else if (questionType === 'situational') {
                    const situationalImageFile = block.querySelector('.situational-image')?.files[0];
                    if (situationalImageFile) {
                        formData.append(`image_${index}`, situationalImageFile);
                    }
                    block.querySelectorAll('.sub-question-text').forEach(subInput => {
                        commonData.sub_questions.push(subInput.value);
                    });
                }

                questionsData.push(commonData);
            });

            // ======================== DƏYİŞİKLİK BURADA BİTİR ========================

            formData.append('questions', JSON.stringify(questionsData));

            fetch('/api/admin/exams', { method: 'POST', credentials: 'include', body: formData })
                .then(res => res.json().then(data => ({ ok: res.ok, data })))
                .then(({ ok, data }) => {
                    alert(data.message);
                    if (ok) {
                        createExamForm.reset();
                        if (questionsContainer) questionsContainer.innerHTML = '';
                        questionCounter = 0;
                        document.querySelector('a[href="#exams"]').click();
                    }
                }).catch(err => { alert('Xəta baş verdi: ' + (err.message || 'Serverə qoşulmaq mümkün olmadı.')); });
        });
    }

    document.querySelectorAll('input[name="publishStatus"]').forEach(radio => {
        radio.addEventListener('change', function () {
            const publishDateContainer = document.getElementById('publish-date-container');
            if (this.value === 'scheduled') {
                publishDateContainer.style.display = 'block';
            } else {
                publishDateContainer.style.display = 'none';
            }
        });
    });

    const changePasswordForm = document.getElementById('change-password-form');
    if (changePasswordForm) {
        // Ayarlar səhifəsi üçün şifrə dəyişmə məntiqi bura gələcək
    }

    // Səhifə yüklənəndə ilkin funksiyaları çağırırıq
    loadExams();
    loadExamMetaData();
});