// admin-dashboard.js (BÜTÜN SON XƏTALAR DÜZƏLDİLMİŞ YEKUN KOD)
document.addEventListener('DOMContentLoaded', () => {
    // --- ÜMUMİ ELEMENTLƏR VƏ NAVİQASİYA ---
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.dashboard-section');
    const logoutBtn = document.getElementById('admin-logout-btn');
    let subjects = [];
    let allOrganizers = [];

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = item.querySelector('a').getAttribute('href').substring(1);
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            sections.forEach(section => section.classList.toggle('active', section.id === targetId));
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
        loadDashboardLeaderboards();
        fetch('/api/admin/exams', { credentials: 'include' })
            .then(response => response.json())
            .then(exams => {
                examsTableBody.innerHTML = '';
                if (!exams || exams.length === 0) {
                    examsTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Heç bir imtahan yaradılmayıb.</td></tr>';
                } else {
                    exams.forEach(exam => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `<td>${exam.name}</td><td>${exam.question_count}</td><td>${exam.is_active ? 'Aktiv' : 'Planlanmış'}</td><td class="actions"><button class="delete-btn" data-exam-id="${exam.id}">Sil</button></td>`;
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
                        tr.innerHTML = `<td>${student.name}</td><td>${student.email}</td><td>${student.school}</td><td>${student.class}</td><td>${student.submissions.length}</td>`;
                        registeredBody.appendChild(tr);
                    });
                }
                guestBody.innerHTML = '';
                if (!guestSubmissions || guestSubmissions.length === 0) {
                    guestBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Hesaba bağlanmamış qonaq iştirakçı yoxdur.</td></tr>';
                } else {
                    guestSubmissions.forEach(sub => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `<td>${sub.guestName}</td><td>${sub.guestEmail}</td><td>${sub.examName}</td><td>${sub.score} bal</td><td>${sub.submittedAt}</td>`;
                        guestBody.appendChild(tr);
                    });
                }
            }).catch(error => {
                console.error("Şagirdləri yükləyərkən xəta:", error);
                registeredBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Məlumatları yükləmək mümkün olmadı.</td></tr>';
                guestBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Məlumatları yükləmək mümkün olmadı.</td></tr>';
            });
    }

    // --- TƏŞKİLATÇILAR BÖLMƏSİ ---
    function loadOrganizers() {
        const organizersTableBody = document.getElementById('organizers-table-body');
        if (!organizersTableBody) return;
        fetch('/api/admin/organizers', { credentials: 'include' })
            .then(response => response.json())
            .then(organizers => {
                allOrganizers = organizers;
                organizersTableBody.innerHTML = '';
                if (!organizers || organizers.length === 0) {
                    organizersTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Heç bir təşkilatçı qeydiyyatdan keçməyib.</td></tr>';
                    return;
                }
                organizers.forEach(org => {
                    const tr = document.createElement('tr');
                    const status = org.can_invite_affiliates ? `<span style="color: green; font-weight: bold;">Kordinator</span>` : `<span>Təşkilatçı</span>`;
                    tr.innerHTML = `<td>${org.name}</td><td>${org.email}</td><td>${org.balance.toFixed(2)}</td><td>${status}</td><td class="actions"><button class="edit-btn" data-org-id="${org.id}">Redaktə Et</button><button class="affiliate-settings-btn" data-org-id="${org.id}">Ayarlar</button></td>`;
                    organizersTableBody.appendChild(tr);
                });
            })
            .catch(error => {
                console.error('Təşkilatçıları yükləyərkən xəta:', error);
                organizersTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Məlumatları yükləmək mümkün olmadı.</td></tr>';
            });
    }
    const organizersSection = document.getElementById('organizers');
    const modal = document.getElementById('organizer-edit-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const editForm = document.getElementById('organizer-edit-form');
    const affiliateModal = document.getElementById('affiliate-settings-modal');
    const closeAffiliateModalBtn = document.getElementById('close-affiliate-modal-btn');
    const affiliateForm = document.getElementById('affiliate-settings-form');

    if (organizersSection) {
        organizersSection.addEventListener('click', (e) => {
            const targetButton = e.target.closest('button');
            if (!targetButton) return;
            const orgId = targetButton.dataset.orgId;
            if (!orgId) return;
            const organizerData = allOrganizers.find(org => org.id === parseInt(orgId));
            if (!organizerData) return;

            if (targetButton.classList.contains('edit-btn')) {
                document.getElementById('edit-org-id').value = organizerData.id;
                document.getElementById('edit-org-name').value = organizerData.name;
                document.getElementById('edit-org-email').value = organizerData.email;
                document.getElementById('edit-org-contact').value = organizerData.contact;
                document.getElementById('edit-org-bank').value = organizerData.bank_account;
                document.getElementById('edit-org-commission').value = organizerData.commission_amount;
                modal.style.display = 'block';
            }

            if (targetButton.classList.contains('affiliate-settings-btn')) {
                document.getElementById('affiliate-org-id').value = organizerData.id;
                document.getElementById('can-invite-affiliates').checked = organizerData.can_invite_affiliates;
                document.getElementById('affiliate-limit').value = organizerData.affiliate_invite_limit;
                document.getElementById('affiliate-commission').value = organizerData.affiliate_commission;
                affiliateModal.style.display = 'block';
            }
        });
    }

    if (closeAffiliateModalBtn) {
        closeAffiliateModalBtn.onclick = () => { affiliateModal.style.display = 'none'; };
    }
    if (affiliateModal) {
        window.addEventListener('click', (event) => {
            if (event.target == affiliateModal) {
                affiliateModal.style.display = "none";
            }
        });
    }

    if (affiliateForm) {
        affiliateForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const orgId = document.getElementById('affiliate-org-id').value;
            const settingsData = {
                can_invite: document.getElementById('can-invite-affiliates').checked,
                limit: document.getElementById('affiliate-limit').value,
                commission: document.getElementById('affiliate-commission').value
            };
            fetch(`/api/admin/organizer/${orgId}/affiliate-settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(settingsData)
            })
                .then(res => res.json())
                .then(result => {
                    alert(result.message);
                    if (result.message.includes('uğurla')) {
                        affiliateModal.style.display = 'none';
                        loadOrganizers();
                    }
                })
                .catch(err => alert("Xəta baş verdi."));
        });
    }
    if (closeModalBtn) { closeModalBtn.onclick = () => { modal.style.display = 'none'; } }
    window.onclick = (event) => { if (event.target == modal) { modal.style.display = 'none'; } }
    if (editForm) {
        editForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const orgId = document.getElementById('edit-org-id').value;
            const updatedData = {
                commission_amount: document.getElementById('edit-org-commission').value
            };
            fetch(`/api/admin/organizer/${orgId}/update`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                body: JSON.stringify(updatedData)
            }).then(res => res.json().then(data => ({ ok: res.ok, data }))).then(({ ok, data }) => {
                alert(data.message); if (ok) { modal.style.display = 'none'; loadOrganizers(); }
            });
        });
    }

    // --- MÜƏLLİMLƏR BÖLMƏSİ ---
    function setupTeachersSection() {
        const createTeacherForm = document.getElementById('create-teacher-form');
        const teachersTableBody = document.getElementById('teachers-table-body');
        const teacherSubjectSelect = document.getElementById('teacher-subject');
        if (teacherSubjectSelect && subjects && subjects.length > 0) {
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
            fetch('/api/admin/teachers', { credentials: 'include' }).then(res => res.json()).then(teachers => {
                teachersTableBody.innerHTML = '';
                if (teachers.length === 0) {
                    teachersTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Sistemdə müəllim yoxdur.</td></tr>';
                } else {
                    teachers.forEach(teacher => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `<td>${teacher.name}</td><td>${teacher.email}</td><td>${teacher.subject}</td><td class="actions"><button class="delete-btn delete-teacher-btn" data-teacher-id="${teacher.id}">Sil</button></td>`;
                        teachersTableBody.appendChild(tr);
                    });
                }
            });
        }
        if (createTeacherForm) {
            createTeacherForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const teacherData = {
                    name: document.getElementById('teacher-name').value, email: document.getElementById('teacher-email').value,
                    password: document.getElementById('teacher-password').value, subject_id: document.getElementById('teacher-subject').value
                };
                fetch('/api/admin/teachers', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                    body: JSON.stringify(teacherData)
                }).then(res => res.json().then(data => ({ ok: res.ok, data }))).then(({ ok, data }) => {
                    alert(data.message); if (ok) { createTeacherForm.reset(); loadTeachers(); }
                });
            });
        }
        if (teachersTableBody) {
            teachersTableBody.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-teacher-btn')) {
                    const teacherId = e.target.dataset.teacherId;
                    if (confirm('Bu müəllimi silmək istədiyinizə əminsiniz?')) {
                        fetch(`/api/admin/teachers/${teacherId}`, { method: 'DELETE', credentials: 'include' })
                            .then(res => res.json().then(data => ({ ok: res.ok, data }))).then(({ ok, data }) => {
                                alert(data.message); if (ok) { loadTeachers(); }
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
    const examTypeSelect = document.getElementById('exam-type');
    let questionCounter = 0;

    function populateSelect(selectElement, items) {
        if (!selectElement || !items) return;
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

    if (examTypeSelect) {
        examTypeSelect.addEventListener('change', (e) => {
            const selectedText = e.target.options[e.target.selectedIndex].text;
            document.querySelectorAll('.question-block').forEach(qBlock => {
                const pointsField = qBlock.querySelector('.points-field');
                if (pointsField) {
                    pointsField.style.display = (selectedText === 'İbtidai Sinif') ? 'block' : 'none';
                }
            });
        });
    }

    if (addQuestionBtn) {
        addQuestionBtn.addEventListener('click', () => {
            questionCounter++;
            const questionBlock = document.createElement('div');
            questionBlock.className = 'question-block';
            questionBlock.id = `question-block-${questionCounter}`;
            const subjectOptions = subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
            const isPrimarySelected = examTypeSelect.options[examTypeSelect.selectedIndex]?.text === 'İbtidai Sinif';

            questionBlock.innerHTML = `
                <h4>Sual ${questionCounter} <button type="button" class="remove-question-btn">Sil</button></h4>
                <div class="form-grid">
                    <div class="form-group"><label>Fənn</label><select class="question-subject" required>${subjectOptions}</select></div>
                    <div class="form-group"><label>Sualın Növü</label><select class="question-type-select" data-block-id="${questionCounter}" required><option value="closed">Qapalı (Variantlı)</option><option value="open">Açıq (Yazılı)</option><option value="situational">Situasiya</option><option value="matching">Uyğunluq</option><option value="fast_tree">Fast Tree (Doğru/Yalan)</option></select></div>
                </div>
                <div class="form-grid">
                    <div class="form-group"><label>Mövzu</label><input type="text" class="question-topic" placeholder="Sualın aid olduğu mövzu..."></div>
                    <div class="form-group"><label>Çətinlik Dərəcəsi</label><select class="question-difficulty"><option value="asan">Asan</option><option value="orta">Orta</option><option value="cetin">Çətin</option></select></div>
                </div>
                <div class="form-grid">
                    <div class="form-group points-field" style="display: ${isPrimarySelected ? 'block' : 'none'};"><label>Sualın balı (İbtidai Sinif üçün)</label><input type="number" class="question-points" value="1" min="1"></div>
                    <div class="form-group"><label>Videoizah üçün Başlanğıc Vaxtı</label><div class="time-input-container"><input type="number" class="time-input-minutes" min="0" max="599" placeholder="MM" value="0"><span class="time-input-separator">:</span><input type="number" class="time-input-seconds" min="0" max="59" placeholder="SS" value="0"></div></div>
                </div>
                <div class="form-group audio-upload-field" style="display: none;"><label>Dinləmə üçün audio fayl (.mp3, .wav)</label><input type="file" class="question-audio" accept="audio/*"></div>
                <div id="main-fields-${questionCounter}">
                    <div class="form-group"><label>Sualın Mətni / Ana Təlimat</label><textarea id="question-text-${questionCounter}" class="question-text tinymce-editor" placeholder="Sualın mətnini bura daxil edin..."></textarea></div>
                    <div class="form-group"><label>Sual üçün şəkil (Əgər redaktorun içində əlavə etmək istəmirsinizsə)</label><input type="file" class="question-image" accept="image/*"></div>
                </div>
                <div id="specific-area-${questionCounter}"></div>
            `;
            questionsContainer.appendChild(questionBlock);
            renderSpecificFields('closed', questionCounter);
            tinymce.init({
                selector: `#question-block-${questionCounter} .tinymce-editor`,
                plugins: 'lists link image table code help wordcount',
                toolbar: 'undo redo | blocks | bold italic backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | removeformat | help',
                height: 250,
            });
        });
    }

    // renderSpecificFields funksiyasını bununla tam əvəz edin
function renderSpecificFields(type, blockId) {
    const specificArea = document.getElementById(`specific-area-${blockId}`);
    const mainFields = document.getElementById(`main-fields-${blockId}`);
    let content = '';

    if(mainFields) {
        const questionTextLabel = mainFields.querySelector('.question-text').closest('.form-group').querySelector('label');
        const questionImageInput = mainFields.querySelector('.question-image').closest('.form-group');
        questionTextLabel.textContent = 'Sualın Mətni / Ana Təlimat';
        questionImageInput.style.display = 'block';
    }

    const existingEditors = specificArea.querySelectorAll('.tinymce-editor');
    existingEditors.forEach(editor => {
        const editorId = editor.id;
        if (editorId) {
            const tinymceInstance = tinymce.get(editorId);
            if (tinymceInstance) { tinymceInstance.remove(); }
        }
    });

    if (type === 'closed') {
        const variants = ['A', 'B', 'C', 'D', 'E'];
        let optionsHTML = variants.map(v => `<div class="form-group option-block"><label>Variant ${v}</label><textarea id="option-text-${blockId}-${v}" class="option-text tinymce-editor" data-variant="${v}"></textarea><input type="file" class="option-image" data-variant="${v}" accept="image/*"></div>`).join('');
        content = `<div class="options-container">${optionsHTML}</div><div class="form-group"><label>Düzgün Cavab Variantı</label><select class="correct-answer-closed">${variants.map(v => `<option value="${v}">${v}</option>`).join('')}</select></div>`;
    } else if (type === 'open') {
        content = `<div class="form-group"><label>Düzgün Cavab</label><textarea id="correct-answer-open-${blockId}" class="correct-answer-open tinymce-editor"></textarea></div>`;
    } else if (type === 'situational') {
        if(mainFields) {
            mainFields.querySelector('.question-text').closest('.form-group').querySelector('label').textContent = 'Situasiyanın Ana Mətni';
            mainFields.querySelector('.question-image').closest('.form-group').style.display = 'none';
        }
        content = `<div class="sub-questions-container"></div><button type="button" class="add-sub-question-btn" data-parent-id="${blockId}">+ Alt-Sual Əlavə Et</button>`;
    } else if (type === 'matching') {
        content = `<div class="matching-container"><div class="matching-column"><h5>Nömrələnmiş Bəndlər (<button type="button" class="add-matching-item-btn" data-type="numbered" data-block-id="${blockId}">+</button>)</h5><div class="matching-items-list" id="numbered-items-${blockId}"><div class="matching-item"><input type="text" placeholder="1-ci bəndin mətni"><button type="button" class="remove-matching-item-btn">X</button></div></div></div><div class="matching-column"><h5>Hərflənmiş Bəndlər (<button type="button" class="add-matching-item-btn" data-type="lettered" data-block-id="${blockId}">+</button>)</h5><div class="matching-items-list" id="lettered-items-${blockId}"><div class="matching-item"><input type="text" placeholder="A bəndinin mətni"><button type="button" class="remove-matching-item-btn">X</button></div></div></div></div><h5>Düzgün Cavabları Qeyd Edin</h5><div class="matching-answers-list" id="matching-answers-${blockId}"></div>`;
    } else if (type === 'fast_tree') {
        if(mainFields) {
            mainFields.querySelector('.question-text').closest('.form-group').querySelector('label').textContent = 'Ana Təlimat (məs: Mətnə əsasən cümlələrin doğruluğunu müəyyən edin)';
        }
        content = `<h5>Sub-questions (True/False Statements)</h5><div class="fast-tree-items-list" id="fast-tree-items-${blockId}"><div class="fast-tree-item"><input type="text" placeholder="1st statement text..."><select class="fast-tree-answer"><option value="A">True (A)</option><option value="B">False (B)</option></select><button type="button" class="remove-matching-item-btn">X</button></div></div><button type="button" class="add-matching-item-btn" data-type="fast_tree" data-block-id="${blockId}">+ Add Statement</button>`;
    }

    specificArea.innerHTML = content;

    if (type === 'matching') {
        updateMatchingAnswerUI(blockId);
    }

    tinymce.init({
        selector: `#specific-area-${blockId} .tinymce-editor`,
        plugins: 'lists link image table code help wordcount',
        toolbar: 'undo redo | blocks | bold italic | alignleft aligncenter alignright | bullist numlist | removeformat | help',
        height: 200,
    });
}

    if (questionsContainer) {
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
            if (e.target.classList.contains('add-matching-item-btn')) {
                const blockId = e.target.dataset.blockId;
                const type = e.target.dataset.type;
                if (type === 'fast_tree') {
                    const container = document.getElementById(`fast-tree-items-${blockId}`);
                    const count = container.children.length;
                    const newItem = document.createElement('div');
                    newItem.className = 'fast-tree-item';
                    newItem.innerHTML = `<input type="text" placeholder="${count + 1}st statement text..."><select class="fast-tree-answer"><option value="A">True (A)</option><option value="B">False (B)</option></select><button type="button" class="remove-matching-item-btn">X</button>`;
                    container.appendChild(newItem);
                } else {
                    const container = document.getElementById(`${type}-items-${blockId}`);
                    const count = container.children.length;
                    const placeholder = type === 'numbered' ? `${count + 1}-ci bəndin mətni` : `${String.fromCharCode(65 + count)} bəndinin mətni`;
                    const newItem = document.createElement('div');
                    newItem.className = 'matching-item';
                    newItem.innerHTML = `<input type="text" placeholder="${placeholder}"><button type="button" class="remove-matching-item-btn">X</button>`;
                    container.appendChild(newItem);
                    updateMatchingAnswerUI(blockId);
                }
            }
            if (e.target.classList.contains('remove-matching-item-btn')) {
                const blockId = e.target.closest('.question-block').id.split('-')[2];
                const questionTypeContainer = e.target.closest('#specific-area-' + blockId);
                e.target.parentElement.remove();
                if (questionTypeContainer && questionTypeContainer.querySelector('.matching-container')) {
                    updateMatchingAnswerUI(blockId);
                }
            }
        });
        
        questionsContainer.addEventListener('change', e => {
            if (e.target.classList.contains('question-subject')) {
                const selectElement = e.target;
                const selectedOptionText = selectElement.options[selectElement.selectedIndex].text;
                const questionBlock = selectElement.closest('.question-block');
                const audioField = questionBlock.querySelector('.audio-upload-field');
                if (selectedOptionText === 'İngilis Dili') {
                    audioField.style.display = 'block';
                } else {
                    audioField.style.display = 'none';
                    audioField.querySelector('input').value = '';
                }
            }
            if (e.target.classList.contains('question-type-select')) {
                renderSpecificFields(e.target.value, e.target.dataset.blockId);
            }
        });
        
        questionsContainer.addEventListener('input', e => {
             const matchingItem = e.target.closest('.matching-item');
             if (matchingItem) {
                const blockId = e.target.closest('.question-block').id.split('-')[2];
                updateMatchingAnswerUI(blockId);
            }
        });
    }

    const createExamSection = document.getElementById('create-exam');
    if (createExamSection) {
        createExamSection.addEventListener('click', (e) => {
            if (e.target.classList.contains('add-new-meta-btn')) {
                const button = e.target;
                const type = button.dataset.type;
                const name = button.dataset.name;
                const newValue = prompt(`Yeni ${name} daxil edin:`);
                if (newValue && newValue.trim() !== '') {
                    fetch(`/api/admin/${type}`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        credentials: 'include', body: JSON.stringify({ name: newValue.trim() })
                    }).then(res => res.json().then(data => ({ ok: res.ok, data }))).then(({ ok, data }) => {
                        alert(data.message);
                        if (ok) { loadExamMetaData(); }
                    }).catch(err => alert('Xəta baş verdi: ' + err));
                }
            }
        });
    }

    if (createExamForm) {
        createExamForm.addEventListener('submit', (e) => {
            e.preventDefault();
            tinymce.triggerSave();
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
            document.querySelectorAll('.question-block').forEach((block, index) => {
                const minutes = block.querySelector('.time-input-minutes').value || 0;
                const seconds = block.querySelector('.time-input-seconds').value || 0;
                const totalSeconds = parseInt(minutes, 10) * 60 + parseInt(seconds, 10);
                const commonData = {
                    question_type: block.querySelector('.question-type-select').value,
                    text: block.querySelector('.question-text').value,
                    subject_id: block.querySelector('.question-subject')?.value,
                    points: block.querySelector('.question-points')?.value,
                    topic: block.querySelector('.question-topic')?.value,
                    difficulty: block.querySelector('.question-difficulty')?.value,
                    video_start_time: totalSeconds,
                    options: {},
                    correct_answer: {},
                };

                const mainImageFile = block.querySelector('.question-image')?.files[0];
                if (mainImageFile) { formData.append(`question_image_${index}`, mainImageFile); }

                const audioFile = block.querySelector('.question-audio')?.files[0];
                if (audioFile) { formData.append(`audio_file_${index}`, audioFile); }

                if (commonData.question_type === 'closed') {
                    const options = [];
                    block.querySelectorAll('.option-block').forEach((optBlock, i) => {
                        const variant = ['A', 'B', 'C', 'D', 'E'][i];
                        const text = optBlock.querySelector('.option-text').value;
                        options.push({ "variant": variant, "text": text, "image_path": null });
                        const imageFile = optBlock.querySelector('.option-image')?.files[0];
                        if (imageFile) { formData.append(`option_image_${index}_${variant}`, imageFile); }
                    });
                    commonData.options = options;
                    commonData.correct_answer = block.querySelector('.correct-answer-closed').value;
                } else if (commonData.question_type === 'open') {
                    commonData.correct_answer = block.querySelector('.correct-answer-open')?.value || "";
                } else if (commonData.question_type === 'situational') {
                    const sub_questions = [];
                    block.querySelectorAll('.sub-question-item').forEach(subItem => {
                        sub_questions.push(subItem.querySelector('.sub-question-text').value);
                    });
                    commonData.options = { sub_questions };
                } else if (commonData.question_type === 'matching') {
                    const matchingData = collectMatchingData(block);
                    commonData.options = matchingData.options;
                    commonData.correct_answer = matchingData.correct_answer;
                } else if (commonData.question_type === 'fast_tree') {
                    const fastTreeData = collectFastTreeData(block);
                    commonData.options = fastTreeData.options;
                    commonData.correct_answer = fastTreeData.correct_answer;
                }
                questionsData.push(commonData);
            });

            formData.append('questions', JSON.stringify(questionsData));
            fetch('/api/admin/exams', {
                method: 'POST', credentials: 'include', body: formData
            }).then(res => res.json().then(data => ({ ok: res.ok, data }))).then(({ ok, data }) => {
                alert(data.message);
                if (ok) {
                    createExamForm.reset();
                    questionsContainer.innerHTML = '';
                    tinymce.remove();
                    document.querySelector('.nav-item a[href="#exams"]').click();
                }
            }).catch(err => {
                alert('Xəta baş verdi: ' + (err.message || 'Serverə qoşulmaq mümkün olmadı.'));
            });
        });
    }

    if (questionsContainer) {
        questionsContainer.addEventListener('paste', (e) => {
            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            let file = null;
            for (const item of items) {
                if (item.type.indexOf('image') === 0) { file = item.getAsFile(); break; }
            }
            if (file) {
                e.preventDefault();
                const randomName = `clipboard_${Date.now()}.png`;
                const imageFile = new File([file], randomName, { type: file.type });
                const pasteTarget = e.target;
                const questionBlock = pasteTarget.closest('.question-block');
                if (!questionBlock) return;
                let fileInput;
                const optionBlock = pasteTarget.closest('.option-block');
                if (optionBlock) { fileInput = optionBlock.querySelector('.option-image'); }
                else { fileInput = questionBlock.querySelector('.question-image'); }
                if (fileInput) {
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(imageFile);
                    fileInput.files = dataTransfer.files;
                    const feedbackElement = document.createElement('span');
                    feedbackElement.textContent = "✅ Şəkil yapışdırıldı!";
                    feedbackElement.style.cssText = 'color: green; margin-left: 10px; font-size: 0.9em;';
                    fileInput.parentNode.appendChild(feedbackElement);
                    setTimeout(() => { feedbackElement.remove(); }, 3000);
                } else {
                    alert("Bu sahə üçün şəkil yükləmə yeri tapılmadı.");
                }
            }
        });
    }
    
    // Səhifə yüklənəndə ilkin funksiyaları çağırırıq
    loadExams();
    loadExamMetaData();

    function updateMatchingAnswerUI(blockId) {
        const numberedItemsContainer = document.getElementById(`numbered-items-${blockId}`);
        const letteredItemsContainer = document.getElementById(`lettered-items-${blockId}`);
        const answersContainer = document.getElementById(`matching-answers-${blockId}`);
        if (!numberedItemsContainer || !letteredItemsContainer || !answersContainer) return;
        const numberedCount = numberedItemsContainer.children.length;
        const letteredOptions = Array.from(letteredItemsContainer.children).map((_, i) => String.fromCharCode(65 + i));
        const existingAnswers = {};
        answersContainer.querySelectorAll('.matching-correct-answer').forEach(select => {
            existingAnswers[select.dataset.num] = select.value;
        });
        answersContainer.innerHTML = '';
        for (let i = 1; i <= numberedCount; i++) {
            const answerRow = document.createElement('div');
            answerRow.className = 'matching-answer-row form-group';
            let optionsHTML = '<option value="">Seçin...</option>';
            letteredOptions.forEach(letter => {
                const isSelected = existingAnswers[i] === letter ? 'selected' : '';
                optionsHTML += `<option value="${letter}" ${isSelected}>${letter}</option>`;
            });
            answerRow.innerHTML = `<label>${i}-ci bəndə uyğun hərf:</label><select class="matching-correct-answer" data-num="${i}">${optionsHTML}</select>`;
            answersContainer.appendChild(answerRow);
        }
    }

    function collectMatchingData(block) {
        const blockId = block.id.split('-')[2];
        const numberedItems = Array.from(block.querySelectorAll(`#numbered-items-${blockId} input`)).map(input => input.value);
        const letteredItems = Array.from(block.querySelectorAll(`#lettered-items-${blockId} input`)).map(input => input.value);
        const correct_answer = {};
        block.querySelectorAll('.matching-correct-answer').forEach(select => {
            if (select.value) {
                correct_answer[select.dataset.num] = select.value;
            }
        });
        return {
            options: { numbered_items: numberedItems.filter(Boolean), lettered_items: letteredItems.filter(Boolean) },
            correct_answer: correct_answer
        };
    }

    function collectFastTreeData(block) {
        const sub_questions = [];
        const correct_answer = {};
        block.querySelectorAll('.fast-tree-item').forEach((item, index) => {
            const text = item.querySelector('input[type="text"]').value;
            const answer = item.querySelector('.fast-tree-answer').value;
            if (text) {
                sub_questions.push(text);
                correct_answer[index + 1] = answer;
            }
        });
        return {
            options: { sub_questions: sub_questions },
            correct_answer: correct_answer
        };
    }
    
    function loadDashboardLeaderboards() {
        const monthlyContainer = document.getElementById('monthly-leaderboard-admin');
        const yearlyContainer = document.getElementById('yearly-leaderboard-admin');
        if (!monthlyContainer || !yearlyContainer) return;
        const createTableHTML = (data) => {
            if (!data || data.length === 0) {
                return '<p class="no-results-admin">Bu dövr üçün nəticə yoxdur.</p>';
            }
            let table = '<table><thead><tr><th class="rank">#</th><th>Şagird</th><th class="score">Ümumi Bal</th></tr></thead><tbody>';
            data.forEach(item => {
                let medal = '';
                if (item.rank === 1) medal = '<i class="fas fa-medal gold"></i>';
                else if (item.rank === 2) medal = '<i class="fas fa-medal silver"></i>';
                else if (item.rank === 3) medal = '<i class="fas fa-medal bronze"></i>';
                table += `
                    <tr>
                        <td class="rank">${medal || item.rank}</td>
                        <td><a href="#" class="student-details-link" data-userid="${item.user_id}">${item.name}</a></td>
                        <td class="score">${item.total_score}</td>
                    </tr>`;
            });
            table += '</tbody></table>';
            return table;
        };
        fetch('/api/leaderboard?period=month')
            .then(res => res.json())
            .then(data => { monthlyContainer.innerHTML = createTableHTML(data); })
            .catch(err => { monthlyContainer.innerHTML = '<p class="no-results-admin">Yükləmək mümkün olmadı.</p>'; });
        fetch('/api/leaderboard?period=year')
            .then(res => res.json())
            .then(data => { yearlyContainer.innerHTML = createTableHTML(data); })
            .catch(err => { yearlyContainer.innerHTML = '<p class="no-results-admin">Yükləmək mümkün olmadı.</p>'; });
    }

    const studentModal = document.getElementById('student-details-modal');
    const studentModalContent = document.getElementById('student-details-content');
    const closeStudentModalBtn = document.getElementById('close-student-modal-btn');

    if(closeStudentModalBtn) {
        closeStudentModalBtn.onclick = () => { studentModal.style.display = 'none'; };
    }
    if(studentModal){
        window.addEventListener('click', (event) => {
            if (event.target == studentModal) {
                studentModal.style.display = "none";
            }
        });
    }

    document.querySelector('.dashboard-content').addEventListener('click', (e) => {
        if (e.target.classList.contains('student-details-link')) {
            e.preventDefault();
            const userId = e.target.dataset.userid;
            studentModalContent.innerHTML = "<p>Yüklənir...</p>";
            studentModal.style.display = 'block';
            fetch(`/api/admin/student/${userId}/details`, { credentials: 'include' })
                .then(res => res.json())
                .then(details => {
                    studentModalContent.innerHTML = `
                        <div class="info-item"><span class="label">Ad Soyad:</span> <span class="value">${details.name}</span></div>
                        <div class="info-item"><span class="label">E-poçt:</span> <span class="value">${details.email}</span></div>
                        <div class="info-item"><span class="label">Əlaqə:</span> <span class="value">${details.contact}</span></div>
                        <div class="info-item"><span class="label">Məktəb:</span> <span class="value">${details.school}</span></div>
                        <div class="info-item"><span class="label">Sinif:</span> <span class="value">${details.class}</span></div>`;
                })
                .catch(err => {
                    studentModalContent.innerHTML = "<p style='color:red;'>Məlumatları yükləmək mümkün olmadı.</p>";
                });
        }
    });
});