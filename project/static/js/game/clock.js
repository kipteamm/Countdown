"use strict";
let isRunning = false;
let animationId = null;
const countdownAudio = new Audio('/static/sounds/tune.mp3');
countdownAudio.volume = 0.5;
function getArcPath(centerX, centerY, radius, startAngle, endAngle) {
    const startRad = (startAngle - 90) * Math.PI / 180.0;
    const endRad = (endAngle - 90) * Math.PI / 180.0;
    const startX = centerX + (radius * Math.cos(startRad));
    const startY = centerY + (radius * Math.sin(startRad));
    const endX = centerX + (radius * Math.cos(endRad));
    const endY = centerY + (radius * Math.sin(endRad));
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return `M ${centerX} ${centerY} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;
}
function resetClock() {
    countdownAudio.pause();
    countdownAudio.currentTime = 0;
    if (animationId !== null) {
        cancelAnimationFrame(animationId);
    }
    const startAngle = 180;
    const endAngle = 360;
    const durationMs = 2000;
    const startTime = Date.now();
    console.log("[CLOCK] RESETTING...");
    const litAreas = document.querySelectorAll('.lit-area');
    litAreas.forEach(area => area.setAttribute('opacity', '0'));
    function animateReset() {
        const elapsedMs = Date.now() - startTime;
        let progress = elapsedMs / durationMs;
        if (isNaN(progress))
            progress = 0;
        progress = Math.max(0, Math.min(progress, 1.0));
        const currentAngle = startAngle + ((endAngle - startAngle) * progress);
        const handGroups = document.querySelectorAll('.hand-group');
        handGroups.forEach(hand => {
            hand.setAttribute('transform', `translate(200, 200) rotate(${currentAngle})`);
        });
        if (progress < 1.0) {
            animationId = requestAnimationFrame(animateReset);
        }
        else {
            isRunning = false;
            console.log("[CLOCK] READY");
            handGroups.forEach(hand => hand.setAttribute('transform', `translate(200, 200) rotate(0)`));
            animationId = null;
        }
    }
    animationId = requestAnimationFrame(animateReset);
}
function startCountdown() {
    if (animationId !== null) {
        cancelAnimationFrame(animationId);
    }
    isRunning = true;
    console.log("[CLOCK] COUNTING DOWN...");
    const startAngle = 0;
    const endAngle = 180;
    const angleRange = endAngle - startAngle;
    countdownAudio.currentTime = 0;
    countdownAudio.play().catch(err => {
        console.warn("Audio playback failed. Ensure user interacted with the page first:", err);
    });
    function animate() {
        let progress = countdownAudio.currentTime / countdownAudio.duration;
        if (isNaN(progress)) {
            progress = 0;
        }
        progress = Math.max(0, Math.min(progress, 1.0));
        const currentAngle = startAngle + (angleRange * progress);
        const handGroups = document.querySelectorAll('.hand-group');
        const litAreas = document.querySelectorAll('.lit-area');
        handGroups.forEach(hand => {
            hand.setAttribute('transform', `translate(200, 200) rotate(${currentAngle})`);
        });
        litAreas.forEach(area => {
            if (currentAngle > startAngle) {
                area.setAttribute('opacity', '1');
                const pathData = getArcPath(200, 200, 145, startAngle, currentAngle);
                area.setAttribute('d', pathData);
            }
            else {
                area.setAttribute('opacity', '0');
            }
        });
        if (progress < 1.0 && !countdownAudio.ended) {
            animationId = requestAnimationFrame(animate);
        }
        else {
            console.log("[CLOCK] FINISHED!");
            handGroups.forEach(hand => hand.setAttribute('transform', `translate(200, 200) rotate(${endAngle})`));
            const finalPath = getArcPath(200, 200, 145, startAngle, endAngle);
            litAreas.forEach(area => area.setAttribute('d', finalPath));
            resetClock();
        }
    }
    animationId = requestAnimationFrame(animate);
}
