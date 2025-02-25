import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyB_3K_NuHuAUaZ3kvumOEh6xdwTgrd9l-g",
  authDomain: "horascomplementares-7c0d5.firebaseapp.com",
  projectId: "horascomplementares-7c0d5",
  storageBucket: "horascomplementares-7c0d5.firebasestorage.app",
  messagingSenderId: "572255851124",
  appId: "1:572255851124:web:fb9e6dfa408471a2feb721",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;

// Categories and Activity Limits
const categories = {
  ensino: { total: 0, limit: 90 },
  extensao: { total: 0, limit: 90 },
  pesquisa: { total: 0, limit: 90 },
};

const activityLimits = {
  // Extensão
  projeto_extensao: { category: "extensao", limit: 40, aproveitamento: 0.1 },
  atividades_culturais: { category: "extensao", limit: 5, aproveitamento: 0.8 },
  visitas_tecnicas: { category: "extensao", limit: 40, aproveitamento: 1 },
  visitas_feiras_exposicoes: { category: "extensao", limit: 5, aproveitamento: 0.2 },
  cursos_idiomas: { category: "extensao", limit: 20, aproveitamento: 0.6 },
  palestras_seminarios_congressos_extensionistas_ouvinte: {
    category: "extensao",
    limit: 10,
    aproveitamento: 0.8,
  },
  palestras_seminarios_congressos_extensionistas_apresentador: {
    category: "extensao",
    limit: 15,
    aproveitamento: 1,
  },
  projeto_empresa_junior: { category: "extensao", limit: 20, aproveitamento: 0.2 },

  // Ensino
  estagio_extracurricular: { category: "ensino", limit: 40, aproveitamento: 0.7 },
  monitoria: { category: "ensino", limit: 40, aproveitamento: 0.7 },
  concursos_campeonatos_academicos: { category: "ensino", limit: 50, aproveitamento: 0.7 },
  presenca_defesa_tcc: { category: "ensino", limit: 3, aproveitamento: 0.5 },
  cursos_profissionalizantes_especificos: { category: "ensino", limit: 40, aproveitamento: 0.8 },
  cursos_profissionalizantes_geral: { category: "ensino", limit: 10, aproveitamento: 0.2 },

  // Pesquisa
  iniciacao_cientifica: { category: "pesquisa", limit: 40, aproveitamento: 0.8 },
  publicacao_artigos_periodicos: { category: "pesquisa", limit: 10, aproveitamento: 1 },
  publicacao_artigos_completos_anais: { category: "pesquisa", limit: 7, aproveitamento: 1 },
  publicacao_capitulo_livro: { category: "pesquisa", limit: 7, aproveitamento: 1 },
  publicacao_resumos_artigos_anais: { category: "pesquisa", limit: 5, aproveitamento: 1 },
  registro_patentes: { category: "pesquisa", limit: 40, aproveitamento: 1 },
  premiacao_pesquisa: { category: "pesquisa", limit: 10, aproveitamento: 1 },
  colaborador_seminarios_congressos: { category: "pesquisa", limit: 10, aproveitamento: 1 },
  palestras_seminarios_congressos_pesquisa_ouvinte: {
    category: "pesquisa",
    limit: 10,
    aproveitamento: 0.8,
  },
  palestras_seminarios_congressos_pesquisa_apresentador: {
    category: "pesquisa",
    limit: 15,
    aproveitamento: 1,
  },
};

// Mapping of categories to activity types
const categoryToActivities = {
  extensao: [
    "projeto_extensao",
    "atividades_culturais",
    "visitas_tecnicas",
    "visitas_feiras_exposicoes",
    "cursos_idiomas",
    "palestras_seminarios_congressos_extensionistas_ouvinte",
    "palestras_seminarios_congressos_extensionistas_apresentador",
    "projeto_empresa_junior",
  ],
  ensino: [
    "estagio_extracurricular",
    "monitoria",
    "concursos_campeonatos_academicos",
    "presenca_defesa_tcc",
    "cursos_profissionalizantes_especificos",
    "cursos_profissionalizantes_geral",
  ],
  pesquisa: [
    "iniciacao_cientifica",
    "publicacao_artigos_periodicos",
    "publicacao_artigos_completos_anais",
    "publicacao_capitulo_livro",
    "publicacao_resumos_artigos_anais",
    "registro_patentes",
    "premiacao_pesquisa",
    "colaborador_seminarios_congressos",
    "palestras_seminarios_congressos_pesquisa_ouvinte",
    "palestras_seminarios_congressos_pesquisa_apresentador",
  ],
};

let totalGeral = 0;
const activityUsage = {};

// Reset Data
function resetData() {
  totalGeral = 0;
  for (const category in categories) {
    categories[category].total = 0;
  }
  for (const type in activityUsage) {
    activityUsage[type] = 0;
  }
  document.getElementById("ensinoTotal").textContent = "0";
  document.getElementById("extensaoTotal").textContent = "0";
  document.getElementById("pesquisaTotal").textContent = "0";
  document.getElementById("totalGeral").textContent = "0";
  document.querySelector("#activitiesTable tbody").innerHTML = "";
}

// Save User Data to Firestore
async function saveUserDataToFirestore(user, username) {
  try {
    await setDoc(doc(db, "users", user.uid), {
      username: username,
      email: user.email,
      createdAt: new Date(),
    });
    console.log("User data saved to Firestore successfully!");
  } catch (error) {
    console.error("Error saving user data to Firestore: ", error);
    alert("Erro ao salvar dados do usuário. Tente novamente mais tarde.");
  }
}

// Save Activity to Firestore
async function saveActivityToFirestore(activity) {
  try {
    if (!currentUser) {
      alert("Usuário não autenticado. Faça login novamente.");
      return;
    }

    const docRef = await addDoc(collection(db, "activities"), {
      userId: currentUser.uid,
      name: activity.name,
      category: activity.category,
      type: activity.type,
      hours: activity.hours,
      effectiveHours: activity.effectiveHours,
      attachmentName: activity.attachmentName,
      createdAt: new Date(),
    });

    console.log("Atividade salva no Firestore com sucesso! Documento ID:", docRef.id);
  } catch (error) {
    console.error("Erro ao salvar atividade no Firestore: ", error);
    alert("Erro ao salvar atividade. Tente novamente mais tarde.");
  }
}

// Load Activities from Firestore
async function loadActivitiesFromFirestore() {
  try {
    if (!currentUser) {
      alert("Usuário não autenticado. Faça login novamente.");
      return;
    }

    const activitiesRef = collection(db, "activities");
    const q = query(activitiesRef, where("userId", "==", currentUser.uid));
    const querySnapshot = await getDocs(q);

    querySnapshot.forEach((doc) => {
      const activity = doc.data();
      addActivityToTable(activity, doc.id);
    });

    console.log("Atividades carregadas do Firestore com sucesso!");
  } catch (error) {
    console.error("Erro ao carregar atividades do Firestore: ", error);
    alert("Erro ao carregar atividades. Tente novamente mais tarde.");
  }
}

// Add Activity to Table
function addActivityToTable(activity, docId) {
  const tableBody = document.querySelector("#activitiesTable tbody");
  const row = document.createElement("tr");

  row.innerHTML = `
    <td>${activity.name}</td>
    <td>${activity.category.toUpperCase()}</td>
    <td>${activity.type.replace(/_/g, " ").toUpperCase()}</td>
    <td>${activity.hours}</td>
    <td>${activity.effectiveHours.toFixed(2)}</td>
    <td>${activity.attachmentName || "Nenhum anexo"}</td>
    <td><button class="remove-btn">Remover</button></td>
  `;

  const removeButton = row.querySelector(".remove-btn");
  removeButton.addEventListener("click", async () => {
    await deleteDoc(doc(db, "activities", docId));
    tableBody.removeChild(row);
    updateTotals(activity, -1);
    updateStudentStatus();
  });

  tableBody.appendChild(row);
  updateTotals(activity, 1);
  updateStudentStatus();
}

// Update Totals
function updateTotals(activity, multiplier) {
  categories[activity.category].total += activity.effectiveHours * multiplier;
  totalGeral += activity.effectiveHours * multiplier;
  activityUsage[activity.type] += activity.effectiveHours * multiplier;

  document.getElementById(`${activity.category}Total`).textContent = categories[activity.category].total.toFixed(2);
  document.getElementById("totalGeral").textContent = totalGeral.toFixed(2);
}

// Handle Form Submission
document.getElementById("activityForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("name").value;
  const category = document.getElementById("category").value;
  const type = document.getElementById("type").value;
  const hours = parseInt(document.getElementById("hours").value);
  const attachmentInput = document.getElementById("attachment");
  const attachmentFile = attachmentInput.files[0];
  const attachmentName = attachmentFile ? attachmentFile.name : "Nenhum anexo";

  if (!categories[category]) {
    alert("Categoria inválida.");
    return;
  }

  if (!activityLimits[type]) {
    alert("Tipo de atividade inválido.");
    return;
  }

  const activityCategory = activityLimits[type].category;
  const activityLimit = activityLimits[type].limit;
  const aproveitamento = activityLimits[type].aproveitamento;

  if (!activityUsage[type]) {
    activityUsage[type] = 0;
  }

  const remainingHoursForType = activityLimit - activityUsage[type];
  const effectiveHours = Math.min(hours * aproveitamento, remainingHoursForType);

  if (effectiveHours === 0) {
    alert(`O limite de horas para o tipo de atividade ${type.replace(/_/g, " ").toUpperCase()} foi atingido.`);
    return;
  }

  if (categories[activityCategory].total + effectiveHours > categories[activityCategory].limit) {
    alert(`O limite de horas para a categoria ${activityCategory.toUpperCase()} foi atingido.`);
    return;
  }

  if (totalGeral + effectiveHours > 270) {
    alert("O limite total de 270 horas foi atingido.");
    return;
  }

  const activity = {
    name,
    category,
    type,
    hours,
    effectiveHours,
    attachmentName,
  };

  await saveActivityToFirestore(activity);
  addActivityToTable(activity);
  document.getElementById("activityForm").reset();
});

// Function to update the "Tipo de Atividade" field
function updateActivityTypes(category) {
  const typeSelect = document.getElementById("type");
  typeSelect.innerHTML = '<option value="">Selecione um tipo</option>';
  if (category && categoryToActivities[category]) {
    categoryToActivities[category].forEach((activity) => {
      const option = document.createElement("option");
      option.value = activity;
      option.textContent = activity.replace(/_/g, " ").toUpperCase();
      typeSelect.appendChild(option);
    });
    typeSelect.disabled = false;
  } else {
    typeSelect.disabled = true;
  }
}

// Event listener for category selection
document.getElementById("category").addEventListener("change", function () {
  const selectedCategory = this.value;
  updateActivityTypes(selectedCategory);
});

// Function to update student status
function updateStudentStatus() {
  const ensinoHours = categories.ensino.total;
  const extensaoHours = categories.extensao.total;
  const pesquisaHours = categories.pesquisa.total;

  document.getElementById("ensinoStatus").textContent = ensinoHours.toFixed(2);
  document.getElementById("extensaoStatus").textContent = extensaoHours.toFixed(2);
  document.getElementById("pesquisaStatus").textContent = pesquisaHours.toFixed(2);
  document.getElementById("totalGeralStatus").textContent = totalGeral.toFixed(2);

  const statusMessageDiv = document.getElementById("statusMessage");
  statusMessageDiv.innerHTML = "";

  if (totalGeral < 150) {
    statusMessageDiv.innerHTML += "O aluno não atingiu o mínimo de 150 horas exigidas. ";
  }

  if (ensinoHours === 0 || extensaoHours === 0 || pesquisaHours === 0) {
    statusMessageDiv.innerHTML += "O aluno precisa incluir atividades em todas as categorias (Ensino, Extensão e Pesquisa). ";
  }

  if (totalGeral >= 150 && ensinoHours > 0 && extensaoHours > 0 && pesquisaHours > 0) {
    statusMessageDiv.innerHTML = "Parabéns! O aluno atingiu o mínimo de horas e cumpriu as regras de distribuição.";
  }
}

// Authentication Handlers
document.getElementById("authForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  try {
    await signInWithEmailAndPassword(auth, `${username}@example.com`, password);
    alert("Login realizado com sucesso!");
  } catch (error) {
    alert("Erro ao fazer login: " + error.message);
  }
});

document.getElementById("registerButton").addEventListener("click", async () => {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  if (!username || !password) {
    alert("Por favor, preencha todos os campos.");
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, `${username}@example.com`, password);
    const user = userCredential.user;
    await saveUserDataToFirestore(user, username); // Save additional user data to Firestore
    alert("Usuário registrado com sucesso! Faça login com suas credenciais.");
    document.getElementById("authForm").reset();
  } catch (error) {
    alert("Erro ao registrar: " + error.message);
  }
});

// Logout Button
document.getElementById("logoutButton").addEventListener("click", async () => {
  try {
    await signOut(auth);
    alert("Você saiu do sistema.");
  } catch (error) {
    alert("Erro ao sair: " + error.message);
  }
});

// Listen for authentication state changes
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    document.getElementById("auth-container").style.display = "none";
    document.getElementById("main-container").style.display = "block";
    resetData();
    loadActivitiesFromFirestore();
  } else {
    currentUser = null;
    document.getElementById("auth-container").style.display = "block";
    document.getElementById("main-container").style.display = "none";
  }
});