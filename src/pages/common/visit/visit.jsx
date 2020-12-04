import React, { useState, useEffect } from 'react';
import { Row, Col, Select, Empty, Table, Button } from 'antd';
import { connect } from 'react-redux';
import { useHistory, useLocation } from 'react-router-dom';
import { removeDuplicates } from 'utils/array';

// APIs
import { getRoomAPI } from 'services/user/room.service';
import { getRoomAPI as adminGetRoomAPI } from 'services/admin/room.service';
import { getVisitDataAPI } from 'services/user/visit.service';
import { getVisitDataAPI as adminGetVisitDataAPI } from 'services/admin/visit.service';
import { addEMRAPI } from 'services/user/emr.service';


const VisitPage = props => {
  const user = props.user;
  const { pathname } = useLocation();

  const history = useHistory();
  const [rooms, setRooms] = useState([]);
  const [roomLoading, setRoomLoading] = useState(false);
  const [visitData, setVisitData] = useState(null);
  const [visitLoading, setVisitLoading] = useState(false);
  const [createEMRLoading, setCreateEMRLoading] = useState([]);

  const [selectedRoom, setSelectedRoom] = useState("");
  const [listEMR, setListEMR] = useState([]);

  const visitList = visitData?.results.filter(visit => {
    const createdAt = new Date(visit.created_at);
    const today = new Date();
    const isToday = createdAt.getDate() === today.getDate() &&
      createdAt.getMonth() === today.getMonth() &&
      createdAt.getFullYear() === today.getFullYear();
    return (isToday && visit.room.id === selectedRoom)
  });

  const tableColumns = [
    {
      title: '#',
      key: '#',
      render: (_, __, index) => index + 1
    },
    {
      title: 'Họ và tên',
      key: 'fullname',
      render: (_, record) => record.patient.first_name + " " + record.patient.last_name
    },
    {
      title: 'Giới tính',
      key: 'gender',
      render: (_, record) => record.patient.gender
    },
    {
      ken: 'action',
      render: (_, record) => <Button onClick={() => handlePatientClick(record)} loading={createEMRLoading.includes(record.id)}>Khám bệnh</Button>
    }
  ]

  async function getRooms() {
    try {
      setRoomLoading(true);
      let roomResponse;
      if (user.role.name === "admin") {
        roomResponse = await adminGetRoomAPI();
      } else if (user.role.name === "physician" || user?.role?.name === "receptionist") {
        roomResponse = await getRoomAPI();
      }
      setRooms(roomResponse.data);

      const prevSelected = localStorage.getItem("selectedRoom");
      setSelectedRoom(prevSelected);
    } catch (error) {
      console.log(error);
    } finally {
      setRoomLoading(false);
    }
  }

  async function getVisitData() {
    try {
      let visitDataResponse;
      setVisitLoading(true);
      if (user.role.name === "admin") {
        visitDataResponse = await adminGetVisitDataAPI();
      } else {
        visitDataResponse = await getVisitDataAPI()
      }
      const visitData = visitDataResponse.data;
      setVisitData(visitData);
    } catch (error) {
      console.log(error);
    } finally {
      setVisitLoading(false);
    }
  }

  async function getInitialData() {
    await Promise.all([
      getVisitData(),
      getRooms(),
    ]);
  }

  useEffect(() => {
    if (user) {
      getInitialData();
    }

    const localListEMRStr = localStorage.getItem("listEMR");
    const localListEMRObj = JSON.parse(localListEMRStr);
    if (localListEMRObj) {
      setListEMR(localListEMRObj);
    }
  }, [user]);

  useEffect(() => {
    if (selectedRoom) {
      localStorage.setItem("selectedRoom", selectedRoom);
    }
  }, [selectedRoom, listEMR])

  async function createEmr(patientId, physicianId, visit) {
    try {
      setCreateEMRLoading(prev => [...prev, ...[visit.id]]);
      const addEMRResponse = await addEMRAPI(patientId, physicianId);
      console.log(addEMRResponse.data);
    } catch (error) {
      console.log(error);
    } finally {
      setCreateEMRLoading(prev => {
        const cloneArr = [...prev];
        cloneArr.splice(cloneArr.indexOf(visit.id), 1);
        return cloneArr
      });
    }
  }

  function handlePatientClick(visit) {
    const { patient } = visit;

    
    // Create an empty EMR
    // createEmr(patient.id, user.id, visit);

    // return;
    setListEMR(prev => {
      const emrObj = {
        id: visit.id,
        patient: {
          id: patient.id,
          first_name: patient.first_name,
          last_name: patient.last_name,
          gender: patient.gender,
          role: patient.role.name,
          avatar: patient.avatar,
          DOB: patient.DOB
        },
        physician: {
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          gender: user.gender,
          role: user.role.name,
          avatar: user.avatar
        },
        room: visit.room.name,
        livingFunctions: {
          heartbeat: null,
          temp: null,
          pressure: null,
          breathing: null,
          height: null,
          weight: null,
          bmi: null
        },
        emr_diseases: null,
        emr_services: null,
        emr_drugs: null,
        images: [],
        created_at: visit.created_at,
        symptom: "",
      }
      const newArr = [...prev, ...[emrObj]];
      const unique = removeDuplicates(newArr, "id");
      localStorage.setItem("listEMR", JSON.stringify(unique));
      return unique;
    });
    history.push(`${pathname}/examination?visit-id=${visit.id}`);
  }

  function handleChangeRoom(value) {
    setSelectedRoom(value);
  }

  return (
    <>
      <Row className="flex-no-wrap">
        <Col style={{ width: 350 }} className="flex-shrink-0">
          <div className="mb-5">
            <h2 className="text-sm">Phòng trực</h2>
            <Select loading={roomLoading} style={{ width: '100%' }} value={selectedRoom} onChange={handleChangeRoom}>
              {
                rooms.map(room => (
                  <Select.Option key={room.id} value={room.id}>{room.name}</Select.Option>
                ))
              }
            </Select>
          </div>


        </Col>
        <Col className="ml-3" flex={1}>
          <h2 className="text-sm">Bệnh nhân đang chờ khám</h2>
          {
            !selectedRoom ?
              <Empty description="Vui lòng chọn phòng" />
              :
              visitList?.length > 0 ?
                <Table dataSource={visitList} columns={tableColumns} rowKey="id" loading={visitLoading} />
                : <Empty description="Không có dữ liệu" />
          }
        </Col>
      </Row>
    </>
  )
}

const mapStateToProps = state => ({
  user: state.userState.user
})

export default connect(mapStateToProps)(VisitPage);