document.addEventListener('DOMContentLoaded', () => {
    // --- BÜTÜN LAZIMI HTML ELEMENTLƏRİNİ ƏVVƏLCƏDƏN SEÇİRİK ---
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
    
    // YENİ: Əlaqələndirici (Affiliate) sistemi üçün elementlər
    const affiliateSection = document.getElementById('affiliate-section');
    const affiliateInviteLinkInput = document.getElementById('affiliateInviteLink');
    const copyAffiliateLinkBtn = document.getElementById('copyAffiliateLinkBtn');
    const affiliateListBody = document.getElementById('affiliate-list-body');

    // Təşkilatçının məlumatlarını saxlamaq üçün qlobal dəyişən
    let currentOrganizerData = {};

    // Fərqli məlumatları səhifədə göstərən köməkçi funksiyalar
    // organizer-profile.js -> Köhnə renderProfileData funksiyasını bununla əvəz edin

function renderProfileData(data) {
    currentOrganizerData = data;
    if(welcomeMessage) welcomeMessage.textContent = `Xoş gəlmisiniz, ${data.name}!`;
    if(balanceValue) balanceValue.textContent = `${(data.balance || 0).toFixed(2)} AZN`;
    if(displayName) displayName.textContent = data.name;
    if(displayEmail) displayEmail.textContent = data.email;
    if(displayContact) displayContact.textContent = data.contact;
    if(displayCard) displayCard.textContent = data.bank_account;
    
    const registrationPageUrl = new URL('register.html', window.location.href);
    // Yoxlayırıq ki, element mövcuddurmu
    if(inviteLinkInput) {
        inviteLinkInput.value = `${registrationPageUrl.origin}/register.html?ref=${data.invite_code}`;
    }

    // Əgər admin icazə veribsə, əlaqələndirici bölməsini göstəririk
    if (data.can_invite_affiliates && affiliateSection) {
        affiliateSection.style.display = 'block';
        
        const affiliateRegUrl = new URL('affiliate-register.html', window.location.href);
        // Yoxlayırıq ki, element mövcuddurmu
        if(affiliateInviteLinkInput) {
            affiliateInviteLinkInput.value = `${affiliateRegUrl.origin}/affiliate-register.html?ref=${data.affiliate_invite_code}`;
        }

        if (affiliateListBody) {
            affiliateListBody.innerHTML = '';
            if (data.affiliates && data.affiliates.length > 0) {
                data.affiliates.forEach(aff => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `<td>${aff.name}</td><td>${aff.email}</td><td><span class="status-active">Aktiv</span></td>`;
                    affiliateListBody.appendChild(tr);
                });
            } else {
                affiliateListBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Heç bir əlaqələndirici dəvət etməmisiniz.</td></tr>';
            }
        }
    }
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
            if(studentListBody) {
                studentListBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Məlumatları yükləmək mümkün olmadı.</td></tr>';
            }
        });
    }

    // Modal pəncərəni idarə edən məntiq
    if (editProfileBtn) {
        editProfileBtn.onclick = function() {
            if (currentOrganizerData.name) {
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
                    loadInitialData();
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

    // Linki kopyalamaq üçün funksiyalar
    window.copyLink = function() {
        inviteLinkInput.select();
        document.execCommand('copy');
        alert("Şagird dəvət linki kopyalandı!");
    }
    
    // YENİ: Əlaqələndirici linkini kopyalamaq
    if (copyAffiliateLinkBtn) {
        copyAffiliateLinkBtn.addEventListener('click', () => {
            affiliateInviteLinkInput.select();
            document.execCommand('copy');
            alert("Əlaqələndirici dəvət linki kopyalandı!");
        });
    }

    // Səhifə yüklənəndə bütün məlumatları yüklə
    loadInitialData();




    // organizer-profile.js -> Faylın sonuna, DOMContentLoaded içinə əlavə edin

const myAffiliatesSection = document.getElementById('my-affiliates-section');
const myAffiliatesListBody = document.getElementById('my-affiliates-list-body');

// organizer-profile.js -> Köhnə loadMyAffiliates funksiyasını bununla əvəz edin
function loadMyAffiliates() {
    if (!myAffiliatesSection) return;

    fetch('/api/organizer/my-affiliates-details', { credentials: 'include' })
        .then(res => res.json())
        .then(affiliates => {
            if (affiliates && affiliates.length > 0) {
                myAffiliatesSection.style.display = 'block';
                myAffiliatesListBody.innerHTML = '';
                affiliates.forEach(aff => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${aff.name}<br><small>${aff.email}</small></td>
                        <td>${aff.contact || 'N/A'}<br><small>${aff.bank_account || 'N/A'}</small></td>
                        <td>${(aff.balance || 0).toFixed(2)}</td>
                        <td>${(aff.commission_rate || 0).toFixed(2)}</td>
                        <td><strong>${aff.registered_student_count}</strong> (${aff.participated_student_count})</td>
                        <td class="actions">
                            <button class="edit-btn" data-aff-id="${aff.id}" data-current-rate="${aff.commission_rate}" data-aff-name="${aff.name}">Dəyiş</button>
                            <button class="reset-balance-btn" data-aff-id="${aff.id}" data-aff-name="${aff.name}">Sıfırla</button>
                        </td>
                    `;
                    myAffiliatesListBody.appendChild(tr);
                });
            }
        });
}

// organizer-profile.js -> Köhnə myAffiliatesListBody.addEventListener blokunu bununla əvəz edin
if (myAffiliatesListBody) {
    myAffiliatesListBody.addEventListener('click', e => {
        const button = e.target.closest('button');
        if (!button) return;

        const affId = button.dataset.affId;
        const affName = button.dataset.affName;

        if (button.classList.contains('edit-btn')) {
            const currentRate = button.dataset.currentRate;
            const newRate = prompt(`'${affName}' üçün yeni komissiya məbləğini daxil edin (AZN):`, currentRate);

            if (newRate !== null && !isNaN(parseFloat(newRate))) {
                fetch(`/api/organizer/affiliate/${affId}/commission`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ commission_rate: newRate })
                })
                .then(res => res.json())
                .then(result => {
                    alert(result.message);
                    loadMyAffiliates();
                });
            }
        }

        if (button.classList.contains('reset-balance-btn')) {
            if (confirm(`'${affName}' adlı əlaqələndiricinin balansını sıfırlamaq istədiyinizə əminsiniz?`)) {
                fetch(`/api/organizer/affiliate/${affId}/reset-balance`, {
                    method: 'POST',
                    credentials: 'include'
                })
                .then(res => res.json())
                .then(result => {
                    alert(result.message);
                    loadMyAffiliates();
                });
            }
        }
    });
}

// `loadInitialData()` funksiyasının çağırıldığı yerin yanına bunu da əlavə edin:
setTimeout(loadMyAffiliates, 500); // Məlumatların yüklənməsini gözləmək üçün kiçik fasilə

// Komissiya dəyişmə məntiqi
if (myAffiliatesListBody) {
    myAffiliatesListBody.addEventListener('click', e => {
        if (e.target.classList.contains('edit-btn')) {
            const affId = e.target.dataset.affId;
            const currentRate = e.target.dataset.currentRate;
            const affName = e.target.dataset.affName;

            const newRate = prompt(`'${affName}' üçün yeni komissiya məbləğini daxil edin (AZN):`, currentRate);

            if (newRate !== null && !isNaN(parseFloat(newRate))) {
                fetch(`/api/organizer/affiliate/${affId}/commission`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ commission_rate: newRate })
                })
                .then(res => res.json())
                .then(result => {
                    alert(result.message);
                    loadMyAffiliates(); // Cədvəli yenilə
                });
            }
        }
    });
}





});


