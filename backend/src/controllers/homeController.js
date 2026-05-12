import User from '../models/user.js';
import * as CRUDService from '../services/CRUDService.js';

export const getHomePage = async (req, res) => {
    try {
        let data = await User.find().lean();
        return res.render('homepage.ejs', {
            data: JSON.stringify(data)
        });
    } catch (e) {
        console.log(e);
    }
}

export const getAboutPage = (req, res) => {
    return res.render('test/about.ejs');
}

export const getCRUD = (req, res) => {
    return res.render('crud.ejs');
}

export const postCRUD = async (req, res) => {
    let message = await CRUDService.createNewUser(req.body);
    console.log(message);
    return res.send('Post crud to server success (MongoDB)');
}

export const getFindAllCrud = async (req, res) => {
    let data = await CRUDService.getAllUser();
    return res.render('users/findAllUser.ejs', {
        datalist: data
    });
}

export const getEditCRUD = async (req, res) => {
    let userId = req.query.id; 
    if (userId) {
        let userData = await CRUDService.getUserInfoById(userId);
        return res.render('users/editUser.ejs', {
            data: userData
        });
    } else {
        return res.send('Không tìm thấy người dùng!');
    }
}

export const putCRUD = async (req, res) => {
    let data = req.body;
    let data1 = await CRUDService.updateUser(data);
    return res.render('users/findAllUser.ejs', {
        datalist: data1
    });
}

export const deleteCRUD = async (req, res) => {
    let id = req.query.id;
    if (id) {
        await CRUDService.deleteUserById(id);
        return res.send('Xóa người dùng thành công!');
    } else {
        return res.send('Người dùng không tồn tại!');
    }
}