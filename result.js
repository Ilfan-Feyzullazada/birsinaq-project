document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const submissionId = urlParams.get('submission_id');

    // === SƏHİFƏDƏKİ BÜTÜN DÜZGÜN ELEMENTLƏRİ SEÇİRİK ===
    const resultContainer = document.getElementById('result-container');
    const examDetailsContainer = document.getElementById('exam-details');
    const finalScoreValue = document.getElementById('final-score-value');
    const correctCount = document.getElementById('correct-count');
    const incorrectCount = document.getElementById('incorrect-count');
    const unansweredCount = document.getElementById('unanswered-count');
    const downloadBtn = document.getElementById('download-cert-btn');

    // YENİ sertifikat şablonu üçün elementlər
    const newCertName = document.getElementById('cert-name-new');
    const newCertScore = document.getElementById('cert-score-new');
    const newCertDate = document.getElementById('cert-date-new');

    if (!submissionId) {
        if (resultContainer) resultContainer.innerHTML = `<p style="color: red; text-align: center;">Nəticə ID-si tapılmadı!</p>`;
        return;
    }

    // === MƏLUMATLARI SERVERDƏN BİR DƏFƏ ÇƏKİB HƏR YERİ DOLDURURUQ ===
    fetch(`/api/submission/${submissionId}/result`, { credentials: 'include' })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw new Error(err.message || 'Nəticələri yükləmək mümkün olmadı.') });
            }
            return response.json();
        })
        .then(data => {
            // 1. Ümumi məlumatları doldururuq (YENİ DİZAYN İLƏ)
            if (examDetailsContainer) {
                examDetailsContainer.innerHTML = `
                <div class="exam-details-grid">
                    <div class="detail-item">
                        <i class="fas fa-book-open"></i>
                        <div>
                            <span class="label">İmtahan Növü</span>
                            <span class="value">${data.exam_type || 'N/A'} - ${data.exam_class || ''}</span>
                        </div>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-file-alt"></i>
                        <div>
                            <span class="label">İmtahan Adı</span>
                            <span class="value">${data.exam_title || 'Adsız'}</span>
                        </div>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-calendar-alt"></i>
                        <div>
                            <span class="label">Tarix</span>
                            <span class="value">${data.submission_date || 'Tarix yoxdur'}</span>
                        </div>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-user-graduate"></i>
                        <div>
                            <span class="label">Şagird</span>
                            <span class="value">${data.student_name || 'Adsız'}</span>
                        </div>
                    </div>
                </div>
            `;
            }

            // 2. Statistika xanalarını doldururuq
            if (finalScoreValue) finalScoreValue.textContent = data.stats?.final_score ?? 'N/A';
            if (correctCount) correctCount.textContent = data.stats?.correct_count ?? 0;
            if (incorrectCount) incorrectCount.textContent = data.stats?.incorrect_count ?? 0;
            if (unansweredCount) unansweredCount.textContent = data.stats?.unanswered_count ?? 0;

            // 3. Detallı nəticə cədvəllərini yaradırıq (Sizin kodunuzda olan hissə)
            let resultsHTML = '';
            let hasPendingQuestions = false;

            if (data.results && data.results.length > 0) {
                data.results.forEach(subjectData => {
                    const subjectScoreInfo = data.stats.subjects[subjectData.subject_name];
                    const subjectScoreText = subjectScoreInfo ? `( ${subjectScoreInfo.score.toFixed(2)} bal )` : '';

                    resultsHTML += `
                        <div class="subject-block">
                            <h3>${subjectData.subject_name} <span class="subject-score">${subjectScoreText}</span></h3>
                            <table class="result-table">
                                <thead>
                                    <tr class="header-row">
    <th>Sıra</th>
    <th>Sual</th>
    <th>Sizin Cavabınız</th>
    <th>Düzgün Cavab</th>
    <th>Sərf Olunan Vaxt</th>
    <th>Mövzu</th>
    <th>Çətinlik</th> </tr>
                                </thead>
                                <tbody>`;

                    // Yuxarıdakı köhnə bloku bununla TAM ƏVƏZ EDİN
                    subjectData.questions.forEach((q, index) => {
                        let rowClass = '';
                        let isCorrect = false;

                        // Cavabları JSON-dan real obyektə çevirməyə çalışırıq
                        if (q.student_answer && typeof q.student_answer === 'string' && (q.student_answer.startsWith('{') || q.student_answer.startsWith('['))) {
                            try { q.student_answer = JSON.parse(q.student_answer); } catch (e) { }
                        }

                        // Mürəkkəb cavabların (uyğunluq, fast tree) yoxlanılması
                        if (typeof q.student_answer === 'object' && q.student_answer !== null && typeof q.correct_answer === 'object' && q.correct_answer !== null) {
                            const studentKeys = Object.keys(q.student_answer);
                            const correctKeys = Object.keys(q.correct_answer);
                            if (studentKeys.length === correctKeys.length) {
                                isCorrect = studentKeys.every(key => q.student_answer[key] === q.correct_answer[key]);
                            }
                        } else { // Sadə cavabların yoxlanılması
                            isCorrect = String(q.student_answer).toLowerCase() === String(q.correct_answer).toLowerCase();
                        }

                        // Sətirlərin rənglənməsi üçün siniflərin təyin edilməsi
                        if (q.status === 'pending_review') {
                            hasPendingQuestions = true;
                            rowClass = 'pending-answer';
                        } else if (!q.student_answer || Object.keys(q.student_answer).length === 0) {
                            rowClass = 'unanswered-row';
                            isCorrect = false; // Cavab yoxdursa, düzgün deyil
                        } else if (isCorrect) {
                            rowClass = 'correct-answer';
                        } else {
                            rowClass = 'incorrect-answer';
                        }

                        // Video izah üçün linkin hazırlanması
                        // Köhnə let questionTitleHTML ... ilə başlayan bütün bloku silib, bunu yapışdırın:

                        let questionTitleHTML = `${index + 1}`;

                        // Fənnə aid video linkini yeni `subject_video_map` obyektindən axtarırıq
                        const videoUrlForSubject = data.subject_video_map && data.subject_video_map[subjectData.subject_name];

                        if (videoUrlForSubject && q.video_start_time) {
                            function getYouTubeID(url) {
                                const arr = url.split(/(vi\/|v%3D|v=|\/v\/|youtu\.be\/|\/embed\/)/);
                                return arr[2] !== undefined ? arr[2].split(/[?&]/)[0] : arr[0];
                            }
                            const videoId = getYouTubeID(videoUrlForSubject);
                            if (videoId) {
                                let videoLink = `https://www.youtube.com/watch?v=${videoId}&t=${q.video_start_time}s`;
                                questionTitleHTML = `<a href="${videoLink}" target="_blank" title="Videoizaha bax" style="text-decoration: none; color: inherit;">${index + 1} <i class="fas fa-play-circle"></i></a>`;
                            }
                        }

                        // Sərf olunan vaxtın formatlanması
                        const timeSpentMs = (data.time_spent && data.time_spent[q.question_id]) ? data.time_spent[q.question_id] : 0;
                        let formattedTime = '0 san';
                        if (timeSpentMs > 0) {
                            const minutes = Math.floor(timeSpentMs / 60000);
                            const seconds = ((timeSpentMs % 60000) / 1000).toFixed(0);
                            formattedTime = minutes > 0 ? `${minutes} dəq ${seconds} san` : `${seconds} san`;
                        }

                        // Mövzu və Çətinliyin təyin edilməsi
                        const topic = q.topic || 'Təyin edilməyib';
                        const difficulty = q.difficulty || 'Təyin edilməyib';

                        // Cavabların göstərilməsi üçün formatlama
                        let studentAnswerDisplay = 'Boş';
                        if (q.student_answer) {
                            if (typeof q.student_answer === 'object') {
                                studentAnswerDisplay = Object.entries(q.student_answer).map(([key, value]) => `${key}-${value}`).join(', ');
                            } else {
                                studentAnswerDisplay = q.student_answer;
                            }
                        }

                        let correctAnswerDisplay = q.correct_answer;
                        if (typeof q.correct_answer === 'object' && q.correct_answer !== null) {
                            correctAnswerDisplay = Object.entries(q.correct_answer).map(([key, value]) => `${key}-${value}`).join(', ');
                        }

                        // Cədvəl sətrinin HTML-ə əlavə edilməsi
                        resultsHTML += `
        <tr class="${rowClass}">
            <td>${questionTitleHTML}</td>
            <td>${q.question_text}</td>
            <td>${studentAnswerDisplay}</td>
            <td>${q.status === 'pending_review' ? 'Yoxlanılır...' : correctAnswerDisplay}</td>
            <td>${formattedTime}</td>
            <td>${topic}</td>
            <td>${difficulty}</td>
        </tr>
    `;
                    });
                    resultsHTML += `</tbody></table></div>`;
                });
            }

            if (hasPendingQuestions && !resultsHTML.includes('pending-notification')) {
                resultsHTML += `<div class="pending-notification" style="background-color: #fff3cd; border-left: 5px solid #ffeeba; padding: 15px; margin-top: 20px; border-radius: 5px;"><p><strong>Qeyd:</strong> Sarı rəngli sətirlər müəllim yoxlaması gözləyən cavablardır. Yekun nəticə müəllim yoxladıqdan sonra hesablanacaq.</p></div>`;
            }

            if (resultContainer) resultContainer.innerHTML = resultsHTML;

            // 4. YENİ sertifikat şablonunu məlumatlarla doldururuq
            if (newCertName) newCertName.textContent = data.student_name || '[AD SOYAD]';
            if (newCertScore) {
                const score = data.stats?.final_score ?? 'X';
                newCertScore.innerHTML = `<span>${score}</span><span class="score-label">bal</span>`;
            }

            if (newCertDate) newCertDate.textContent = data.submission_date || '[Tarix]';
        })
        .catch(error => {
            console.error("Nəticə səhifəsində xəta:", error);
            if (resultContainer) resultContainer.innerHTML = `<p style="color: red; text-align: center;">Xəta baş verdi: ${error.message}</p>`;
        });


    // 5. PDF yükləmə düyməsi üçün DÜZGÜN listener
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            const certificateElement = document.getElementById('new-certificate-template');
            if (!certificateElement) {
                alert("Sertifikat şablonu HTML-də tapılmadı! Zəhmət olmasa, 'result.html' faylını yoxlayın.");
                return;
            }

            const { jsPDF } = window.jspdf;
            const studentNameForFile = newCertName ? (newCertName.textContent || 'telebe') : 'telebe';

            certificateElement.parentElement.style.left = '0px';

            html2canvas(certificateElement, { scale: 3, useCORS: true }).then(canvas => {
                certificateElement.parentElement.style.left = '-9999px';
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                pdf.save(`${studentNameForFile}-sertifikat.pdf`);
            }).catch(err => {
                console.error("PDF yaradılarkən xəta:", err);
                alert("PDF yaradılarkən xəta baş verdi. Brauzer konsoluna baxın.");
                certificateElement.parentElement.style.left = '-9999px';
            });
        });
    }
});