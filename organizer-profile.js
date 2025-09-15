document.addEventListener('DOMContentLoaded', () => {
    // Bütün lazımi HTML elementlərini əvvəlcədən seçirik
    const welcomeMessage = document.getElementById('welcome-message');
    const balanceValue = document.getElementById('balance-value');
    const studentCountValue = document.getElementById('student-count-value');
    const examCountValue = document.getElementById('exam-count-value');
    const displayName = document.getElementById('display-name');
    const displayEmail = document.getElementById('display-email');
    const displayContact = document.getElementById('display-contact');
    const displayCard = document.getElementById('display-card');
    const inviteLinkInput = document.getElementById('inviteLink');
    const studentListBody = document.getElementById('student-list-body');
    const logoutBtn = document.getElementById('logout-btn');
    const modal = document.getElementById('edit-modal');
    const editProfileBtn = document.getElementById('edit-profile-btn');
    const closeBtn = document.querySelector('.close-btn');
    const editForm = document.getElementById('edit-form');
    const editName = document.getElementById('edit-name');
    const editContact = document.getElementById('edit-contact');
    const editCard = document.getElementById('edit-card');
    const editEmail = document.getElementById('edit-email');
    
    // Təşkilatçının məlumatlarını saxlamaq üçün qlobal dəyişən
    let currentOrganizerData = {};

    // Fərqli məlumatları səhifədə göstərən köməkçi funksiyalar
    function renderProfileData(data) {
        currentOrganizerData = data; // Məlumatları redaktə üçün yadda saxlayırıq
        welcomeMessage.textContent = `Xoş gəlmisiniz, ${data.name}!`;
        // DÜZƏLİŞ: Balans 'undefined' olsa belə xəta verməsin deyə (data.balance || 0) istifadə edirik
        balanceValue.textContent = `${(data.balance || 0).toFixed(2)} AZN`;
        displayName.textContent = data.name;
        displayEmail.textContent = data.email;
        displayContact.textContent = data.contact;
        displayCard.textContent = data.bank_account; // Kart nömrəsi tam görünür
        
        const registrationPageUrl = new URL('register.html', window.location.href).href;
        inviteLinkInput.value = `${registrationPageUrl}?invite_code=${data.invite_code}`;
    }

    function renderStudentData(students) {
        if (!studentListBody) return;
        studentListBody.innerHTML = '';
        let totalExams = 0;

        if (!students || students.length === 0) {
            studentListBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Dəvət etdiyiniz şagird yoxdur.</td></tr>';
            studentCountValue.textContent = 0;
            examCountValue.textContent = 0;
            return;
        }
        
        studentCountValue.textContent = students.length;

        students.forEach(student => {
            if (student.submissions && student.submissions.length > 0) {
                totalExams += student.submissions.length;
                student.submissions.forEach(sub => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><span class="student-name">${student.name}</span></td>
                        <td>${sub.exam_title}</td>
                        <td><strong>${sub.score} bal</strong></td>
                        <td>${sub.date}</td>
                    `;
                    studentListBody.appendChild(tr);
                });
            }
        });

        if (totalExams === 0) {
            studentListBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Dəvət etdiyiniz şagirdlər hələ imtahan verməyib.</td></tr>';
        }

        examCountValue.textContent = totalExams;
    }

    // Əsas məlumatları yükləyən funksiya
    function loadInitialData() {
        // Eyni anda həm profil, həm də şagird məlumatlarını çəkirik
        Promise.all([
            fetch('/api/organizer/profile', { credentials: 'include' }),
            fetch('/api/organizer/students', { credentials: 'include' })
        ])
        .then(async ([profileRes, studentsRes]) => {
            if (!profileRes.ok) {
                window.location.href = 'organizer.html';
                throw new Error('Giriş edilməyib və ya sessiyanın vaxtı bitib.');
            }
            const profileData = await profileRes.json();
            const studentsData = await studentsRes.json();
            return [profileData, studentsData];
        })
        .then(([profileData, studentsData]) => {
            renderProfileData(profileData);
            renderStudentData(studentsData);
        })
        .catch(error => {
            console.error("Panel yüklənərkən xəta baş verdi:", error.message);
            welcomeMessage.textContent = 'Məlumatları yükləmək mümkün olmadı.';
            studentListBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Məlumatları yükləmək mümkün olmadı.</td></tr>';
        });
    }

    // Modal pəncərəni idarə edən məntiq
    if (editProfileBtn) {
        editProfileBtn.onclick = function() {
            if (currentOrganizerData.name) { // Yalnız məlumatlar yükləndikdən sonra aç
                editName.value = currentOrganizerData.name;
                editContact.value = currentOrganizerData.contact;
                editCard.value = currentOrganizerData.bank_account;
                editEmail.value = currentOrganizerData.email;
                modal.style.display = "block";
            } else {
                alert("Zəhmət olmasa, məlumatların tam yüklənməsini gözləyin.");
            }
        }
    }
    if (closeBtn) {
        closeBtn.onclick = function() {
            modal.style.display = "none";
        }
    }
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }

    // Formanı submit etdikdə məlumatları yeniləyən məntiq
    if (editForm) {
        editForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const updatedData = {
                name: editName.value,
                contact: editContact.value,
                bank_account: editCard.value,
                email: editEmail.value
            };

            fetch('/api/organizer/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(updatedData)
            })
            .then(response => response.json())
            .then(result => {
                alert(result.message);
                if (result.message.includes('uğurla')) {
                    modal.style.display = "none";
                    loadInitialData(); // Bütün paneli yeni məlumatlarla yeniləyirik
                }
            })
            .catch(error => {
                console.error('Xəta:', error);
                alert('Məlumatları yeniləyərkən xəta baş verdi.');
            });
        });
    }

    // Hesabdan çıxış
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            fetch('/api/logout', { method: 'POST', credentials: 'include' })
                .then(() => window.location.href = 'organizer.html');
        });
    }

    // Linki kopyalamaq üçün funksiya
    window.copyLink = function() {
        inviteLinkInput.select();
        document.execCommand('copy');
        alert("Dəvət linki kopyalandı!");
    }

    // Səhifə yüklənəndə bütün məlumatları yüklə
    loadInitialData();
});