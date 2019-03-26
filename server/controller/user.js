var mysql = require('mysql');
const userDao = require('../daos/user')
const friendDao = require('../daos/friend')
const { getReads, clearRead, getUserMsg } = require('../daos/message')

// exports.index = async function (ctx) {
//     ctx.render('index.html');
// };

const formatTime = i => {
    const d = new Date(i.create_date * 1000),
        n = new Date(),
        day = n.getDate() - d.getDate(),
        date = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2);
    if (day == 0) {
        i.date = `${date}`
    } else if (day == 1) {
        i.date = `昨天 ${date}`
    } else {
        i.date = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()} ${date}`
    }
    return i;
};

const mergeReads = (list, reads) => {
    return list.map(l => {
        const obj = reads.find(r => r.id == l.id);
        l.reads = obj ? obj.count : 0
        return l;
    });
};

exports.getInfo = async function (ctx) {
    const token = await ctx.verify();
    const [users, friends, applys, reads] = await Promise.all([userDao.query({ id: token.uid }), friendDao.getFriends([token.uid]), friendDao.getApply([token.uid]), getReads([token.uid])]);
    const msgs = applys.map(formatTime);
    ctx.body = {
        code: 0,
        message: '好友列表',
        data: { user: users[0], friends: mergeReads(friends, reads), msgs }
    };
}

exports.updateInfo = async function (ctx) {
    const form = ctx.request.body;
    const token = await ctx.verify();
    const ret = await userDao.update([form, token.uid]);
    if (!ret.affectedRows) {
        return ctx.body = {
            code: 2,
            message: '更新失败'
        };
    }
    ctx.body = {
        code: 0,
        message: '更新成功'
    };
}

exports.getMsg = async function (ctx) {
    const { id } = ctx.query;
    const { uid } = await ctx.verify();
    const list = await getUserMsg([id, uid, uid, id]);
    const msgs = list.map(formatTime).map(l => {
        l.msg = l.content;
        l.self = l.send_id == uid;
        return l;
    });
    clearRead([uid, id]);
    ctx.body = {
        code: 0,
        message: '消息列表',
        data: msgs
    };
}

exports.apply = async function (ctx) {
    const form = ctx.request.body;
    const token = await ctx.verify();
    const ret = await friendDao.apply({ ...form, from_id: token.uid });
    if (!ret.affectedRows) {
        return ctx.body = {
            code: 2,
            message: '申请失败'
        };
    }
    ctx.body = {
        code: 0,
        message: '申请成功'
    };

}

exports.accept = async function (ctx) {
    const { friend_id } = ctx.request.body;
    const token = await ctx.verify();
    const ret = await friendDao.reply([{ status: 1 }, friend_id, token.uid]);
    if (!ret.affectedRows) {
        return ctx.body = {
            code: 2,
            message: '添加好友失败'
        };
    }
    const addRet = await friendDao.sql(`replace into user_friend values ('${token.uid}','${friend_id}'),('${friend_id}','${token.uid}')`);
    if (!addRet.affectedRows) {
        return ctx.body = {
            code: 3,
            message: '添加好友失败'
        };
    }
    ctx.body = {
        code: 0,
        message: '添加好友成功'
    };
}

exports.reject = async function (ctx) {
    const { friend_id } = ctx.request.body;
    const token = await ctx.verify();
    const ret = await friendDao.reply([{ status: 2 }, friend_id, token.uid]);
    if (!ret.affectedRows) {
        return ctx.body = {
            code: 2,
            message: '操作失败'
        };
    }
    ctx.body = {
        code: 0,
        message: '操作成功'
    };

}

exports.delFriend = async function (ctx) {
    const { friend_id } = ctx.request.body;
    const token = await ctx.verify();
    const sqlStr = `delete from user_friend where user_id = '${token.uid}' and friend_id ='${friend_id}' or user_id = '${friend_id}' and friend_id ='${token.uid}'`
    const ret = await friendDao.sql(sqlStr);
    if (!ret.affectedRows) {
        return ctx.body = {
            code: 2,
            message: '删除好友失败'
        };
    }
    ctx.body = {
        code: 0,
        message: '删除好友成功'
    };

}

exports.search = async function (ctx) {
    const { kw } = ctx.query;
    const k1 = mysql.escape(kw + '%'), k2 = mysql.escape('%' + kw + '%');
    const users = await userDao.sql(`select * from user where name like ${k1} or name like ${k2} or nick like ${k1} or nick like ${k2} or cast(num as char) like ${k1}`);
    ctx.body = {
        code: 0,
        message: '操作成功',
        data: users
    };
}