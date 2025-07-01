let userName = "";
const urlParams = new URLSearchParams(window.location.search);
const groupName = urlParams.get("group") || "default-group";
const db = firebase.database();
const localAnswers = {};  // stores user's current edits

window.addEventListener("DOMContentLoaded", () => {
  // Identify user
  if (localStorage.getItem("username")) {
    userName = localStorage.getItem("username");
  } else {
    userName = prompt("Enter your name:") || "Anonymous";
    localStorage.setItem("username", userName);
  }

  const inputs = document.querySelectorAll(".question input");
  const buttons = document.querySelectorAll(".activate-btn");
  const questions = document.querySelectorAll(".question");
  const passwordField = document.getElementById("passwordField");

  // Activate question input (lock it)
  buttons.forEach(button => {
    button.addEventListener("click", () => {
      const key = button.dataset.key;
      db.ref(`groups/${groupName}/locks/${key}`).set(userName);
    });
  });

  // Handle input and blur events
  inputs.forEach(input => {
    const key = input.dataset.key;

    input.addEventListener("input", () => {
      const answer = input.value.trim();
      localAnswers[key] = answer;
      db.ref(`groups/${groupName}/sharedAnswers/${key}`).set(answer);
      updatePassword();
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        input.blur();
      }
    })

    input.addEventListener("blur", () => {
      db.ref(`groups/${groupName}/locks/${key}`).once("value", snapshot => {
        if (snapshot.val() === userName) {
          db.ref(`groups/${groupName}/locks/${key}`).remove();
        }
      });
    });
  });

  // Build final password from shared answers
  function updatePassword() {
    const letters = Array.from(inputs).map(i => {
      const val = i.value.trim();
      return val ? val[0].toLowerCase() : "_";
    });
    const password = letters.join("");
    passwordField.value = password;

    // Add glow if correct
    if (password === "dcmdbd") {
      passwordField.classList.add("password-correct");
    } else {
      passwordField.classList.remove("password-correct");
    }

    db.ref(`groups/${groupName}/sharedPassword`).set(password);
  }

  // Global listener: update fields with shared answers
  db.ref(`groups/${groupName}/sharedAnswers`).on("value", snapshot => {
    const sharedData = snapshot.val() || {};

    inputs.forEach(input => {
      const key = input.dataset.key;
      const sharedValue = sharedData[key];

      // Update only if you're not actively typing
      if (
        document.activeElement !== input &&
        input.disabled === true &&
        sharedValue !== undefined &&
        input.value !== sharedValue
      ) {
        input.value = sharedValue;
      }
    });

    updatePassword();
  });

  // Lock logic to manage editing rights
  db.ref(`groups/${groupName}/locks`).on("value", snapshot => {
    const locks = snapshot.val() || {};

    questions.forEach(question => {
      const key = question.dataset.key;
      const input = question.querySelector("input");
      const button = question.querySelector("button");

      const lockedBy = locks[key];

      if (lockedBy && lockedBy !== userName) {
        question.style.opacity = "0.5";
        input.disabled = true;
        button.disabled = true;
        button.textContent = `${lockedBy} is editing...`;
      } else if (lockedBy === userName) {
        question.style.opacity = "1";
        input.disabled = false;
        button.disabled = true;
        button.textContent = `You are editing`;
        input.focus();
      } else {
        question.style.opacity = "1";
        input.disabled = true;
        button.disabled = false;
        button.textContent = "Answer this question";
      }
    });
  });

  // Load current shared answers on entry
  db.ref(`groups/${groupName}/sharedAnswers`).once("value", snapshot => {
    const shared = snapshot.val();
    if (shared) {
      inputs.forEach(input => {
        const key = input.dataset.key;
        if (shared[key]) {
          input.value = shared[key];
          localAnswers[key] = shared[key];
        }
      });
      updatePassword();
    }
  });
});
