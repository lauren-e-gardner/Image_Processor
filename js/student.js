// Credit to COS426 Staff
var Student = {
  // please fill in your name and NetID
  //  your NetID is the part of your email before @princeton.edu
  name: "Lauren-Gardner",
  netID: "leg3",
};

Student.updateHTML = function() {
  var studentInfo = this.name + " &lt;" + this.netID + "&gt;";
  document.getElementById("student").innerHTML = studentInfo;
};
