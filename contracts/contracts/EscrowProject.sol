// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract EscrowProject {

    enum Status { Open, Active, Delivered, Completed, Disputed, Refunded }

    struct Project {
        address payable company;
        address payable student;
        uint256 amount;
        uint256 deadline;
        Status  status;
        string  title;
        string  description;
    }

    address public arbiter;
    uint256 public projectCount;
    uint256 public platformFee;

    mapping(uint256 => Project) public projects;

    event ProjectCreated(uint256 indexed id, address company, uint256 amount, string title);
    event StudentAssigned(uint256 indexed id, address student);
    event WorkDelivered(uint256 indexed id);
    event FundsReleased(uint256 indexed id, address student, uint256 amount);
    event DisputeRaised(uint256 indexed id, address raisedBy);
    event DisputeResolved(uint256 indexed id, bool favorStudent);
    event ProjectRefunded(uint256 indexed id);

    modifier onlyCompany(uint256 id)  { require(msg.sender == projects[id].company,  "Solo la empresa"); _; }
    modifier onlyStudent(uint256 id)  { require(msg.sender == projects[id].student,  "Solo el estudiante"); _; }
    modifier onlyArbiter()            { require(msg.sender == arbiter, "Solo el arbitro"); _; }
    modifier inStatus(uint256 id, Status s) { require(projects[id].status == s, "Estado incorrecto"); _; }

    constructor(uint256 _feeBps) {
        arbiter     = msg.sender;
        platformFee = _feeBps;
    }

    function createProject(
        address payable _student,
        uint256 _deadline,
        string calldata _title,
        string calldata _description
    ) external payable returns (uint256) {
        require(msg.value > 0, "Debe fondear el proyecto");
        require(_deadline > block.timestamp, "Deadline debe ser futuro");

        uint256 id = projectCount++;
        projects[id] = Project({
            company:     payable(msg.sender),
            student:     _student,
            amount:      msg.value,
            deadline:    _deadline,
            status:      _student != address(0) ? Status.Active : Status.Open,
            title:       _title,
            description: _description
        });

        emit ProjectCreated(id, msg.sender, msg.value, _title);
        if (_student != address(0)) emit StudentAssigned(id, _student);
        return id;
    }

    function assignStudent(uint256 id, address payable _student)
        external onlyCompany(id) inStatus(id, Status.Open)
    {
        projects[id].student = _student;
        projects[id].status  = Status.Active;
        emit StudentAssigned(id, _student);
    }

    function deliverWork(uint256 id)
        external onlyStudent(id) inStatus(id, Status.Active)
    {
        projects[id].status = Status.Delivered;
        emit WorkDelivered(id);
    }

    function approveAndRelease(uint256 id)
        external onlyCompany(id) inStatus(id, Status.Delivered)
    {
        Project storage p = projects[id];
        p.status = Status.Completed;

        uint256 fee    = (p.amount * platformFee) / 10000;
        uint256 payout = p.amount - fee;

        p.student.transfer(payout);
        if (fee > 0) payable(arbiter).transfer(fee);

        emit FundsReleased(id, p.student, payout);
    }

    function raiseDispute(uint256 id) external {
        Project storage p = projects[id];
        require(msg.sender == p.company || msg.sender == p.student, "Solo participantes");
        require(p.status == Status.Active || p.status == Status.Delivered, "Estado no disputable");
        p.status = Status.Disputed;
        emit DisputeRaised(id, msg.sender);
    }

    function resolveDispute(uint256 id, bool favorStudent)
        external onlyArbiter inStatus(id, Status.Disputed)
    {
        Project storage p = projects[id];
        p.status = Status.Completed;
        if (favorStudent) { p.student.transfer(p.amount); }
        else              { p.company.transfer(p.amount); }
        emit DisputeResolved(id, favorStudent);
    }

    function claimRefund(uint256 id)
        external onlyCompany(id) inStatus(id, Status.Active)
    {
        Project storage p = projects[id];
        require(block.timestamp > p.deadline, "Deadline no vencido");
        p.status = Status.Refunded;
        p.company.transfer(p.amount);
        emit ProjectRefunded(id);
    }

    function getProject(uint256 id) external view returns (Project memory) {
        return projects[id];
    }
}
